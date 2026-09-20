function throwIfContextLost(gl) {
  if (typeof gl?.isContextLost === 'function' && gl.isContextLost()) {
    throw new Error('WebGL context was lost during startup shader reflection');
  }
}

function programLabel(program) {
  return program?.name || program?.type || 'unknown program';
}

function reportLinkFailure(program, gl, handle, onShaderError) {
  const linkError = new Error('shader link failed during startup warmup: ' + programLabel(program));
  if (typeof onShaderError === 'function') {
    try {
      onShaderError(gl, handle, program.vertexShader, program.fragmentShader);
    } catch (callbackError) {
      throw new AggregateError([linkError, callbackError], 'shader link failed and renderer debug callback threw');
    }
    throw linkError;
  }
  const details = [
    'Material: ' + (program.name || '(unnamed)') + ' (' + (program.type || 'unknown') + ')',
    'Program Info Log: ' + (gl.getProgramInfoLog(handle)?.trim() || '(empty)'),
    'Vertex Shader Log: ' + (gl.getShaderInfoLog(program.vertexShader)?.trim() || '(empty)'),
    'Fragment Shader Log: ' + (gl.getShaderInfoLog(program.fragmentShader)?.trim() || '(empty)'),
  ].join('\n');
  // Match Three's diagnostic console fallback only when the app has no callback.
  console.error('THREE.WebGLProgram: Shader Error during startup warmup\n' + details);
  throw linkError;
}

function reflectionDetails(program, phase) {
  return {
    phase,
    programId: Number.isInteger(program?.id) ? program.id : null,
    materialName: String(program?.name || '(unnamed)'),
    materialType: String(program?.type || 'unknown'),
    handle: program?.program,
  };
}

/**
 * Reflect every newly compiled Three WebGLProgram only after its actual
 * parallel-compile readiness and LINK_STATUS have both been verified.
 * Three's first getter initializes both lazy caches and runs onFirstUse.
 */
export async function verifyAndReflectShaderPrograms({
  programs,
  gl,
  checkShaderErrors,
  verifiedPrograms,
  yieldControl = () => Promise.resolve(),
  maxPrograms = 512,
  maxReadinessYields = 120,
  onReflectionPhase,
  onShaderError,
} = {}) {
  if (checkShaderErrors !== true) {
    throw new Error('shader diagnostics are disabled; startup readiness cannot be verified');
  }
  if (!(verifiedPrograms instanceof Set)) {
    throw new TypeError('verified shader programs must use the pipeline-owned Set');
  }
  if (!Number.isInteger(maxPrograms) || maxPrograms < 0) {
    throw new RangeError('maxPrograms must be a non-negative integer');
  }
  if (!Number.isInteger(maxReadinessYields) || maxReadinessYields < 0) {
    throw new RangeError('maxReadinessYields must be a non-negative integer');
  }

  let checked = 0;
  let reflected = 0;
  let alreadyInitialized = 0;
  let readinessYields = 0;
  const visited = new Set();

  for (const program of programs ?? []) {
    if (!program || visited.has(program)) continue;
    visited.add(program);
    if (verifiedPrograms.has(program)) {
      alreadyInitialized += 1;
      continue;
    }
    if (++checked > maxPrograms) {
      throw new RangeError('shader first-use reflection limit exceeded (' + maxPrograms + ')');
    }

    const handle = program.program;
    if (!handle) throw new Error('shader program handle disappeared before first-use reflection');
    if (typeof program.isReady !== 'function') {
      throw new Error('shader program has no readiness contract: ' + programLabel(program));
    }

    let waitsForReadiness = 0;
    while (program.isReady() !== true) {
      throwIfContextLost(gl);
      if (waitsForReadiness >= maxReadinessYields) {
        throw new Error('shader program readiness did not settle within ' + maxReadinessYields +
          ' yields: ' + programLabel(program));
      }
      waitsForReadiness += 1;
      readinessYields += 1;
      await yieldControl();
    }

    throwIfContextLost(gl);
    if (gl.getProgramParameter(handle, gl.LINK_STATUS) !== true) {
      reportLinkFailure(program, gl, handle, onShaderError);
    }

    onReflectionPhase?.(reflectionDetails(program, 'start'));
    let initializationError = null;
    try {
      if (typeof program.getUniforms !== 'function' || typeof program.getAttributes !== 'function') {
        throw new TypeError('shader program lacks Three reflection getters: ' + programLabel(program));
      }
      const uniforms = program.getUniforms();
      if (uniforms === undefined || uniforms === null) {
        throw new Error('shader uniforms reflection returned no cache: ' + programLabel(program));
      }
      const attributes = program.getAttributes();
      if (attributes === undefined || attributes === null) {
        throw new Error('shader attributes reflection returned no cache: ' + programLabel(program));
      }
      throwIfContextLost(gl);
    } catch (error) {
      initializationError = error;
    }
    let probeError = null;
    try {
      onReflectionPhase?.(reflectionDetails(program, initializationError ? 'error' : 'end'));
    } catch (error) {
      probeError = error;
    }
    if (initializationError && probeError) {
      throw new AggregateError([initializationError, probeError], 'shader reflection and diagnostic probe both failed');
    }
    if (initializationError) throw initializationError;
    if (probeError) throw probeError;

    // Cache only after both getters returned successfully; Three's first getter
    // normally fills both caches, and the second call confirms the real API path.
    verifiedPrograms.add(program);
    reflected += 1;
    await yieldControl();
  }

  return {
    checked,
    reflected,
    alreadyInitialized,
    readinessYields,
    totalVerified: verifiedPrograms.size,
    reflectionCoverage: 'all distinct programs exposed by renderer.info.programs in this warmup pass',
  };
}

const positive = (value) => Number.isFinite(value) && value > 0;

function dimension(primary, fallback, lastResort) {
  if (positive(primary)) return primary;
  if (positive(fallback)) return fallback;
  return lastResort;
}

// CSS pixels only; the renderer's drawing buffer has an independent pixel ratio.
export function readCssViewport(source = {}) {
  const visual = source.visualViewport;
  return {
    width: dimension(visual?.width, source.innerWidth, 1280),
    height: dimension(visual?.height, source.innerHeight, 720),
  };
}

// ResizeObserver supplies the rendered CSS box without a synchronous DOM query.
export function readCssBox(entry) {
  const width = entry?.contentRect?.width;
  const height = entry?.contentRect?.height;
  return positive(width) && positive(height) ? { width, height } : null;
}

export function sameCssSize(a, b, epsilon = 0.01) {
  return Boolean(a && b && Math.abs(a.width - b.width) < epsilon && Math.abs(a.height - b.height) < epsilon);
}

// Pointer events and a canvas filling the visual viewport use the same CSS pixel dimensions.
export function pointerToNdc(clientX, clientY, viewport) {
  const width = dimension(viewport?.width, 1, 1);
  const height = dimension(viewport?.height, 1, 1);
  return { x: (clientX / width) * 2 - 1, y: -(clientY / height) * 2 + 1 };
}

// The same resize handler is wired to native viewport events and exercised by the CPU probe.
export function createCssViewportResizer({ sourceWindow, getCurrentSize, writeCssSize, afterResize, onSizeChange }) {
  if (!sourceWindow || typeof getCurrentSize !== 'function' || typeof writeCssSize !== 'function') {
    throw new TypeError('window, current size, and CSS size writer are required');
  }
  return function resizeCssViewport() {
    const next = readCssViewport(sourceWindow);
    const changed = !sameCssSize(getCurrentSize(), next);
    if (changed) writeCssSize(next);
    afterResize?.();
    if (changed) onSizeChange?.(next);
    return changed;
  };
}

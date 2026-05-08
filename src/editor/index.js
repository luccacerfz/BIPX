import {
  CONFIG_SCHEMA,
  CONFIG_TARGETS,
  forceConfigTarget,
  getAllOverrides,
  getConfig,
  getRuntimeConfig,
  resetAllConfig,
  resetConfig,
  setConfig,
} from "../config/index.js";

const editorState = {
  selectedPath: "camera",
  target: "desktop",
};
const logEntries = [];

if (shouldBootEditor()) {
  bootEditor();
}

function bootEditor() {
  loadEditorStyles();
  document.body.classList.add("bipx-editor-active");

  const shell = document.createElement("aside");
  shell.className = "bipx-editor";
  shell.innerHTML = `
    <header class="bipx-editor__toolbar">
      <strong>BIPX Editor</strong>
      <button data-editor-action="play" type="button">Play</button>
      <button data-editor-action="bright" type="button">Bright</button>
      <button data-editor-action="reset" type="button">Reset</button>
      <label>
        Target
        <select data-editor-target>
          ${CONFIG_TARGETS.map((target) => `<option value="${target}">${target}</option>`).join("")}
        </select>
      </label>
      <button data-editor-action="export" type="button">Export JSON</button>
      <button data-editor-action="collapse" type="button">Hide</button>
    </header>
    <section class="bipx-editor__hierarchy" aria-label="Hierarchy"></section>
    <section class="bipx-editor__game-view" aria-label="Game View">
      <span>Game View</span>
    </section>
    <section class="bipx-editor__inspector" aria-label="Inspector"></section>
    <section class="bipx-editor__console" aria-label="Console"></section>
  `;
  document.body.appendChild(shell);

  const miniButton = document.createElement("button");
  miniButton.className = "bipx-editor-toggle";
  miniButton.type = "button";
  miniButton.textContent = "Editor";
  miniButton.hidden = true;
  document.body.appendChild(miniButton);

  shell.addEventListener("click", (event) => handleEditorClick(event, shell, miniButton));
  shell.addEventListener("input", handleEditorInput);
  miniButton.addEventListener("click", () => {
    shell.classList.remove("is-hidden");
    miniButton.hidden = true;
  });

  forceConfigTarget(editorState.target);
  renderEditor(shell);
  log("Editor iniciado em localhost.");
}

function renderEditor(shell = document.querySelector(".bipx-editor")) {
  if (!shell) {
    return;
  }

  shell.querySelector("[data-editor-target]").value = editorState.target;
  renderHierarchy(shell.querySelector(".bipx-editor__hierarchy"));
  renderInspector(shell.querySelector(".bipx-editor__inspector"));
  renderConsole(shell.querySelector(".bipx-editor__console"));
}

function renderHierarchy(container) {
  container.innerHTML = `
    <h2>Hierarchy</h2>
    <nav>
      ${Object.entries(CONFIG_SCHEMA)
        .map(([sectionKey, section]) => renderHierarchySection(sectionKey, section))
        .join("")}
    </nav>
  `;
}

function renderHierarchySection(sectionKey, section) {
  const sectionSelected = editorState.selectedPath === sectionKey;
  const groups = section.groups
    ? Object.entries(section.groups)
        .map(([groupKey, group]) => {
          const path = `${sectionKey}.${groupKey}`;
          return `
            <button class="bipx-editor__tree-item bipx-editor__tree-item--child ${editorState.selectedPath === path ? "is-selected" : ""}" data-editor-select="${path}" type="button">
              ${escapeHtml(group.label || groupKey)}
            </button>
          `;
        })
        .join("")
    : "";

  return `
    <div class="bipx-editor__tree-group">
      <button class="bipx-editor__tree-item ${sectionSelected ? "is-selected" : ""}" data-editor-select="${sectionKey}" type="button">
        ${escapeHtml(section.label || sectionKey)}
      </button>
      ${groups}
    </div>
  `;
}

function renderInspector(container) {
  const { title, fields } = getSelectedFields();
  container.innerHTML = `
    <h2>Inspector</h2>
    <div class="bipx-editor__selected">${escapeHtml(title)}</div>
    <div class="bipx-editor__fields">
      ${fields.map(renderField).join("") || "<p class=\"bipx-editor__empty\">Selecione um grupo editavel.</p>"}
    </div>
  `;
}

function renderField(field) {
  const value = getConfig(field.path);
  const resetButton = `<button class="bipx-editor__field-reset" data-editor-reset="${field.path}" type="button">Reset</button>`;

  if (field.type === "color") {
    return `
      <label class="bipx-editor__field">
        <span>${escapeHtml(field.label)}</span>
        <input data-editor-field="${field.path}" data-editor-type="color" type="color" value="${toHexColor(value)}" />
        ${resetButton}
      </label>
    `;
  }

  return `
    <label class="bipx-editor__field">
      <span>${escapeHtml(field.label)}</span>
      <input
        data-editor-field="${field.path}"
        data-editor-type="number"
        type="range"
        min="${field.min ?? 0}"
        max="${field.max ?? 1}"
        step="${field.step ?? 0.01}"
        value="${Number(value) || 0}"
      />
      <input
        data-editor-field="${field.path}"
        data-editor-type="number"
        class="bipx-editor__number"
        type="number"
        min="${field.min ?? 0}"
        max="${field.max ?? 1}"
        step="${field.step ?? 0.01}"
        value="${Number(value) || 0}"
      />
      ${resetButton}
    </label>
  `;
}

function renderConsole(container) {
  container.innerHTML = `
    <h2>Console</h2>
    <pre>${escapeHtml(logEntries.slice(-8).join("\n"))}</pre>
  `;
}

function getSelectedFields() {
  const [sectionKey, groupKey] = editorState.selectedPath.split(".");
  const section = CONFIG_SCHEMA[sectionKey];

  if (!section) {
    return { title: "Unknown", fields: [] };
  }

  if (groupKey && section.groups?.[groupKey]) {
    const group = section.groups[groupKey];
    return {
      title: `${section.label || sectionKey} / ${group.label || groupKey}`,
      fields: normalizeFields(`${sectionKey}.${groupKey}`, group.fields),
    };
  }

  if (section.fields) {
    return {
      title: section.label || sectionKey,
      fields: normalizeFields(sectionKey, section.fields),
    };
  }

  const firstGroupKey = Object.keys(section.groups || {})[0];
  if (firstGroupKey) {
    const group = section.groups[firstGroupKey];
    return {
      title: `${section.label || sectionKey} / ${group.label || firstGroupKey}`,
      fields: normalizeFields(`${sectionKey}.${firstGroupKey}`, group.fields),
    };
  }

  return { title: section.label || sectionKey, fields: [] };
}

function normalizeFields(basePath, fields = {}) {
  return Object.entries(fields).map(([fieldKey, field]) => ({
    ...field,
    label: field.label || fieldKey,
    path: field.path || `${basePath}.${fieldKey}`,
  }));
}

function handleEditorClick(event, shell, miniButton) {
  const selectButton = event.target.closest("[data-editor-select]");
  if (selectButton) {
    editorState.selectedPath = selectButton.dataset.editorSelect;
    renderEditor(shell);
    return;
  }

  const resetFieldButton = event.target.closest("[data-editor-reset]");
  if (resetFieldButton) {
    resetConfig(resetFieldButton.dataset.editorReset);
    log(`Reset ${resetFieldButton.dataset.editorReset}`);
    renderEditor(shell);
    return;
  }

  const actionButton = event.target.closest("[data-editor-action]");
  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.editorAction;
  if (action === "play") {
    window.__zombieNightDebug?.start?.();
    log("Play acionado.");
  } else if (action === "bright") {
    applyBrightPreset();
    log("Preset claro aplicado.");
  } else if (action === "reset") {
    resetAllConfig();
    log("Overrides resetados.");
  } else if (action === "export") {
    exportConfig();
  } else if (action === "collapse") {
    shell.classList.add("is-hidden");
    miniButton.hidden = false;
  }

  renderEditor(shell);
}

function applyBrightPreset() {
  const values = {
    "fog.color": 0x17212a,
    "fog.density": 0.009,
    "lighting.hemi.skyColor": 0xd7e8ff,
    "lighting.hemi.groundColor": 0x38485c,
    "lighting.hemi.intensity": 3.1,
    "lighting.moon.color": 0xf1f7ff,
    "lighting.moon.intensity": 4.2,
    "lighting.player.intensity": 5.4,
    "lighting.player.distance": 58,
    "quality.highPixelRatio": 2,
    "quality.mediumPixelRatio": 1.6,
    "quality.mobileHighPixelRatio": 1.75,
    "quality.mobileMediumPixelRatio": 1.45,
  };

  for (const [path, value] of Object.entries(values)) {
    setConfig(path, value);
  }
}

function handleEditorInput(event) {
  const input = event.target.closest("[data-editor-field], [data-editor-target]");
  if (!input) {
    return;
  }

  if (input.matches("[data-editor-target]")) {
    editorState.target = input.value;
    forceConfigTarget(editorState.target);
    log(`Target: ${editorState.target}`);
    renderEditor();
    return;
  }

  const value = input.dataset.editorType === "color" ? fromHexColor(input.value) : Number(input.value);
  setConfig(input.dataset.editorField, value);

  for (const sibling of document.querySelectorAll(`[data-editor-field="${input.dataset.editorField}"]`)) {
    if (sibling !== input) {
      sibling.value = input.value;
    }
  }
}

async function exportConfig() {
  const payload = {
    target: editorState.target,
    config: getRuntimeConfig(),
    overrides: getAllOverrides(),
  };
  const json = JSON.stringify(payload, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    log("Config exportada para clipboard.");
  } catch {
    log(json);
  }
}

function loadEditorStyles() {
  if (document.querySelector("link[data-bipx-editor-style]")) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/editor/layout.css";
  link.dataset.bipxEditorStyle = "true";
  document.head.appendChild(link);
}

function log(message) {
  logEntries.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  renderConsole(document.querySelector(".bipx-editor__console"));
}

function shouldBootEditor() {
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const editorRequested = params.get("editor") === "1" || params.get("admin") === "editor";
  const localHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.");

  return localHost && editorRequested;
}

function toHexColor(value) {
  if (typeof value === "string" && value.startsWith("#")) {
    return value;
  }

  const number = Math.max(0, Math.min(0xffffff, Number(value) || 0));
  return `#${number.toString(16).padStart(6, "0")}`;
}

function fromHexColor(value) {
  return Number.parseInt(String(value).replace("#", ""), 16);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

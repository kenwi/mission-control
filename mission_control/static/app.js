const THEMES = [
  { id: "dark", label: "Mission dark" },
  { id: "light", label: "Mission light" },
  { id: "midnight", label: "Midnight" },
  { id: "dawn", label: "Dawn" },
  { id: "ember", label: "Ember" },
  { id: "cradle", label: "Geo cradle" },
  { id: "synthwave", label: "Neon dusk" },
  { id: "frostline", label: "Frostline" },
  { id: "phosphor", label: "Phosphor" },
  { id: "verdant", label: "Verdant" },
  { id: "operator", label: "Operator deck" },
];

const THEME_STORAGE_KEY = "mc-theme";

function debounce(fn, ms) {
  let t = null;
  return function debounced(...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn.apply(this, args);
    }, ms);
  };
}

function applyTheme(id) {
  const valid = THEMES.some((t) => t.id === id);
  const themeId = valid ? id : "dark";
  document.documentElement.setAttribute("data-theme", themeId);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch (_) {
    /* ignore */
  }
  const sel = document.getElementById("theme-select");
  if (sel && sel.value !== themeId) sel.value = themeId;
}

let themeToastHideTimer = null;

function showThemeToast(label) {
  const el = document.getElementById("mc-theme-toast");
  if (!el) return;
  el.textContent = `Theme: ${label}`;
  el.classList.add("is-visible");
  if (themeToastHideTimer) clearTimeout(themeToastHideTimer);
  themeToastHideTimer = setTimeout(() => {
    themeToastHideTimer = null;
    el.classList.remove("is-visible");
  }, 2800);
}

function themeHotkeyTargetBlocks(el) {
  if (!(el instanceof Element)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function cycleThemeWithHotkey(dir) {
  const step = dir < 0 ? -1 : 1;
  let cur = document.documentElement.getAttribute("data-theme");
  if (!cur) {
    try {
      cur = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
    } catch (_) {
      cur = "dark";
    }
  }
  let idx = THEMES.findIndex((t) => t.id === cur);
  if (idx < 0) idx = 0;
  const n = THEMES.length;
  const next = THEMES[(idx + step + n) % n];
  applyTheme(next.id);
  showThemeToast(next.label);
}

function initThemeHotkey() {
  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyT") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (themeHotkeyTargetBlocks(e.target)) return;
    e.preventDefault();
    cycleThemeWithHotkey(e.shiftKey ? -1 : 1);
  });
}

function initTheme() {
  let saved = "dark";
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  } catch (_) {
    /* ignore */
  }
  const sel = document.getElementById("theme-select");
  if (sel) {
    sel.innerHTML = THEMES.map(
      (t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`
    ).join("");
    sel.addEventListener("change", () => applyTheme(sel.value));
  }
  applyTheme(saved);
  initThemeHotkey();
}

const CLOCK_FORMAT_KEY = "mc-clock-format";
let clockFormatHour12 = false;

function loadClockFormat() {
  try {
    return localStorage.getItem(CLOCK_FORMAT_KEY) === "12" ? "12" : "24";
  } catch (_) {
    return "24";
  }
}

function initClockFormatControl() {
  clockFormatHour12 = loadClockFormat() === "12";
  const sel = document.getElementById("clock-format-select");
  if (!sel) return;
  sel.value = clockFormatHour12 ? "12" : "24";
  sel.addEventListener("change", () => {
    clockFormatHour12 = sel.value === "12";
    try {
      localStorage.setItem(CLOCK_FORMAT_KEY, clockFormatHour12 ? "12" : "24");
    } catch (_) {
      /* ignore */
    }
    tickClock();
  });
}

const MODAL_WIDTH_KEY = "mc-modal-width-preset";

/** Max content width for detail dialogs (process, mount, ZFS pool, network). */
const MODAL_WIDTH_PRESETS = {
  compact: "40rem",
  medium: "50rem",
  wide: "62rem",
  xwide: "75rem",
};

function normalizeModalWidthPreset(v) {
  return MODAL_WIDTH_PRESETS[v] ? v : "medium";
}

function loadModalWidthPreset() {
  try {
    const v = localStorage.getItem(MODAL_WIDTH_KEY);
    if (v && MODAL_WIDTH_PRESETS[v]) return v;
  } catch (_) {
    /* ignore */
  }
  return "medium";
}

function applyModalWidthPreset(presetId) {
  const id = normalizeModalWidthPreset(presetId);
  document.documentElement.style.setProperty("--mc-modal-max-width", MODAL_WIDTH_PRESETS[id]);
}

function initModalWidthControl() {
  const sel = document.getElementById("modal-width-select");
  const id = loadModalWidthPreset();
  applyModalWidthPreset(id);
  if (!sel) return;
  sel.value = id;
  sel.addEventListener("change", () => {
    const v = normalizeModalWidthPreset(sel.value);
    try {
      localStorage.setItem(MODAL_WIDTH_KEY, v);
    } catch (_) {
      /* ignore */
    }
    applyModalWidthPreset(v);
    sel.value = v;
  });
}

const CONTENT_LAYOUT_MAX_KEY = "mc-content-max-preset";

/** Max width for the main dashboard grid (`main.mc-grid`). */
const CONTENT_LAYOUT_MAX_PRESETS = {
  narrow: "56rem",
  balanced: "1200px",
  wide: "90rem",
  full: "calc(100vw - 2.5rem)",
};

function normalizeContentLayoutMaxPreset(v) {
  return CONTENT_LAYOUT_MAX_PRESETS[v] ? v : "balanced";
}

function loadContentLayoutMaxPreset() {
  try {
    const v = localStorage.getItem(CONTENT_LAYOUT_MAX_KEY);
    if (v && CONTENT_LAYOUT_MAX_PRESETS[v]) return v;
  } catch (_) {
    /* ignore */
  }
  return "balanced";
}

function applyContentLayoutMaxPreset(presetId) {
  const id = normalizeContentLayoutMaxPreset(presetId);
  document.documentElement.style.setProperty("--mc-content-max-width", CONTENT_LAYOUT_MAX_PRESETS[id]);
}

function initContentLayoutMaxControl() {
  const sel = document.getElementById("content-layout-max-select");
  const id = loadContentLayoutMaxPreset();
  applyContentLayoutMaxPreset(id);
  if (!sel) return;
  sel.value = id;
  sel.addEventListener("change", () => {
    const v = normalizeContentLayoutMaxPreset(sel.value);
    try {
      localStorage.setItem(CONTENT_LAYOUT_MAX_KEY, v);
    } catch (_) {
      /* ignore */
    }
    applyContentLayoutMaxPreset(v);
    sel.value = v;
  });
}

const CONTENT_PADDING_KEY = "mc-content-padding-preset";

/** Padding for `main.mc-grid` (top, horizontal, bottom). */
const CONTENT_PADDING_PRESETS = {
  tight: "0.5rem 0.75rem 1rem",
  balanced: "1rem 1.25rem 2rem",
  relaxed: "1.25rem 1.75rem 2.5rem",
  spacious: "1.5rem 2.25rem 3rem",
};

function normalizeContentPaddingPreset(v) {
  return CONTENT_PADDING_PRESETS[v] ? v : "balanced";
}

function loadContentPaddingPreset() {
  try {
    const v = localStorage.getItem(CONTENT_PADDING_KEY);
    if (v && CONTENT_PADDING_PRESETS[v]) return v;
  } catch (_) {
    /* ignore */
  }
  return "balanced";
}

function applyContentPaddingPreset(presetId) {
  const id = normalizeContentPaddingPreset(presetId);
  document.documentElement.style.setProperty("--mc-content-padding", CONTENT_PADDING_PRESETS[id]);
}

function initContentPaddingControl() {
  const sel = document.getElementById("content-padding-select");
  const id = loadContentPaddingPreset();
  applyContentPaddingPreset(id);
  if (!sel) return;
  sel.value = id;
  sel.addEventListener("change", () => {
    const v = normalizeContentPaddingPreset(sel.value);
    try {
      localStorage.setItem(CONTENT_PADDING_KEY, v);
    } catch (_) {
      /* ignore */
    }
    applyContentPaddingPreset(v);
    sel.value = v;
  });
}

function initSettingsDrawer() {
  const drawer = document.getElementById("settings-drawer");
  const backdrop = document.getElementById("settings-backdrop");
  const toggle = document.getElementById("settings-toggle");
  const closeBtn = document.getElementById("settings-close");
  if (!drawer || !backdrop || !toggle) return;

  function setOpen(open) {
    drawer.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    drawer.setAttribute("aria-hidden", String(!open));
    backdrop.setAttribute("aria-hidden", String(!open));
  }

  toggle.addEventListener("click", () => {
    setOpen(!drawer.classList.contains("is-open"));
  });
  closeBtn?.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) {
      setOpen(false);
    }
  });
}

const PANEL_IDS = ["compute", "thermal", "operations", "storage", "network", "containers", "processes"];
const PANEL_LABELS = {
  compute: "Compute",
  thermal: "Thermal",
  operations: "Operations",
  storage: "Storage",
  network: "Network",
  containers: "Containers",
  processes: "Top processes",
};
const PANEL_VISIBILITY_KEY = "mc-panel-visibility";
const PANEL_ORDER_KEY = "mc-panel-order";
const PANEL_COLLAPSED_KEY = "mc-panel-collapsed";
const STORAGE_DISK_IO_COLLAPSED_KEY = "mc-storage-disk-io-collapsed";
const THERMAL_SENSORS_COLLAPSED_KEY = "mc-thermal-sensors-collapsed";
const THERMAL_FANS_COLLAPSED_KEY = "mc-thermal-fans-collapsed";
const NETWORK_INTERFACES_COLLAPSED_KEY = "mc-network-interfaces-collapsed";
const NETWORK_LISTEN_PORTS_COLLAPSED_KEY = "mc-network-listen-ports-collapsed";
const LISTEN_PORTS_SEARCH_KEY = "mc-listen-ports-search";
const LISTEN_PORTS_PROTO_FILTER_KEY = "mc-listen-ports-proto-filter";
const LISTEN_PORTS_FAMILY_FILTER_KEY = "mc-listen-ports-family-filter";
const STORAGE_MOUNTS_COLLAPSED_KEY = "mc-storage-mounts-collapsed";
const STORAGE_ZFS_COLLAPSED_KEY = "mc-storage-zfs-collapsed";
const DOCKER_CONT_COLLAPSED_KEY = "mc-docker-containers-collapsed";
const DOCKER_IMG_COLLAPSED_KEY = "mc-docker-images-collapsed";
const DOCKER_VOL_COLLAPSED_KEY = "mc-docker-volumes-collapsed";
const DOCKER_CONT_SORT_KEYDIR_KEY = "mc-docker-cont-sort-keydir";
const DOCKER_IMG_SORT_KEYDIR_KEY = "mc-docker-img-sort-keydir";
const DOCKER_VOL_SORT_KEYDIR_KEY = "mc-docker-vol-sort-keydir";

function loadPanelVisibility() {
  const d = {};
  for (const id of PANEL_IDS) d[id] = true;
  try {
    const o = JSON.parse(localStorage.getItem(PANEL_VISIBILITY_KEY) || "null");
    if (o && typeof o === "object") {
      for (const id of PANEL_IDS) {
        if (typeof o[id] === "boolean") d[id] = o[id];
      }
      if ("disk_io" in o && typeof o.disk_io === "boolean") {
        d.storage = d.storage || o.disk_io;
      }
    }
  } catch (_) {
    /* ignore */
  }
  return d;
}

function savePanelVisibility(vis) {
  try {
    localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(vis));
  } catch (_) {
    /* ignore */
  }
}

function applyPanelVisibility() {
  const vis = loadPanelVisibility();
  for (const id of PANEL_IDS) {
    const el = document.querySelector(`section.panel[data-panel-id="${id}"]`);
    if (el) el.hidden = vis[id] === false;
  }
}

function initPanelVisibilityControls() {
  const mount = document.getElementById("panel-visibility-checks");
  if (!mount) return;
  mount.innerHTML = "";
  const vis = loadPanelVisibility();
  for (const id of PANEL_IDS) {
    const label = document.createElement("label");
    label.className = "mc-settings-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.panelId = id;
    input.checked = vis[id] !== false;
    label.appendChild(input);
    label.appendChild(document.createTextNode(PANEL_LABELS[id] || id));
    mount.appendChild(label);
    input.addEventListener("change", () => {
      const next = { ...loadPanelVisibility() };
      next[id] = input.checked;
      savePanelVisibility(next);
      applyPanelVisibility();
      connectMetricsStream();
    });
  }
  applyPanelVisibility();
}

const HEADER_TITLE_KEY = "mc-header-title";
const HEADER_TITLE_VISIBLE_KEY = "mc-header-title-visible";
const STREAM_PAUSED_KEY = "mc-stream-paused";

function effectiveHeaderTitle(raw) {
  const t = String(raw ?? "").trim();
  return t.length ? t.slice(0, 80) : "Mission Control";
}

function loadHeaderTitleText() {
  try {
    const t = localStorage.getItem(HEADER_TITLE_KEY);
    if (t != null && String(t).trim() !== "") return String(t).trim().slice(0, 80);
  } catch (_) {
    /* ignore */
  }
  return "Mission Control";
}

function loadHeaderTitleVisible() {
  try {
    return localStorage.getItem(HEADER_TITLE_VISIBLE_KEY) !== "0";
  } catch (_) {
    return true;
  }
}

function loadStreamPaused() {
  try {
    return localStorage.getItem(STREAM_PAUSED_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function saveStreamPaused(on) {
  try {
    localStorage.setItem(STREAM_PAUSED_KEY, on ? "1" : "0");
  } catch (_) {
    /* ignore */
  }
}

function applyHeaderTitleToDom() {
  const input = document.getElementById("header-title-input");
  const visChk = document.getElementById("header-title-visible");
  const span = document.getElementById("header-title-text");
  const title = input ? effectiveHeaderTitle(input.value) : loadHeaderTitleText();
  const visible = visChk ? visChk.checked : loadHeaderTitleVisible();
  if (span) {
    span.textContent = title;
    span.hidden = !visible;
  }
  document.title = title;
}

function initHeaderPrefs() {
  const input = document.getElementById("header-title-input");
  const vis = document.getElementById("header-title-visible");
  if (input) {
    input.value = loadHeaderTitleText();
    const debouncedSaveTitle = debounce(() => {
      try {
        localStorage.setItem(HEADER_TITLE_KEY, effectiveHeaderTitle(input.value));
      } catch (_) {
        /* ignore */
      }
    }, 400);
    input.addEventListener("input", () => {
      applyHeaderTitleToDom();
      debouncedSaveTitle();
    });
    input.addEventListener("change", () => {
      try {
        localStorage.setItem(HEADER_TITLE_KEY, effectiveHeaderTitle(input.value));
      } catch (_) {
        /* ignore */
      }
      applyHeaderTitleToDom();
    });
  }
  if (vis) {
    vis.checked = loadHeaderTitleVisible();
    vis.addEventListener("change", () => {
      try {
        localStorage.setItem(HEADER_TITLE_VISIBLE_KEY, vis.checked ? "1" : "0");
      } catch (_) {
        /* ignore */
      }
      applyHeaderTitleToDom();
    });
  }
  applyHeaderTitleToDom();
}

const UPDATE_INTERVAL_KEY = "mc-update-interval";
const STREAM_INTERVAL_OPTIONS = [0.25, 0.5, 1, 2, 5, 10, 15, 20, 30];

function snapStreamInterval(sec) {
  let best = 1;
  let bestD = Infinity;
  for (const o of STREAM_INTERVAL_OPTIONS) {
    const d = Math.abs(o - sec);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function loadUpdateInterval() {
  try {
    const v = parseFloat(localStorage.getItem(UPDATE_INTERVAL_KEY) || "1");
    if (!Number.isFinite(v)) return 1;
    return snapStreamInterval(Math.min(30, Math.max(0.25, v)));
  } catch (_) {
    return 1;
  }
}

let metricsEventSource = null;

/** Section is shown in the layout (visible checkbox) and panel title is expanded. */
function panelStreamActive(panelId) {
  const section = document.querySelector(`section.panel[data-panel-id="${panelId}"]`);
  if (!section) return true;
  if (section.hidden) return false;
  if (section.classList.contains("is-collapsed")) return false;
  return true;
}

function streamIncludeCompute() {
  return panelStreamActive("compute");
}

function streamIncludeThermalSensors() {
  return panelStreamActive("thermal") && !loadSubsectionCollapsed(THERMAL_SENSORS_COLLAPSED_KEY);
}

function streamIncludeThermalFans() {
  return panelStreamActive("thermal") && !loadSubsectionCollapsed(THERMAL_FANS_COLLAPSED_KEY);
}

function streamIncludeOperations() {
  return panelStreamActive("operations");
}

function streamIncludeDiskMounts() {
  return panelStreamActive("storage") && !loadSubsectionCollapsed(STORAGE_MOUNTS_COLLAPSED_KEY);
}

function streamIncludeZfsPools() {
  return panelStreamActive("storage") && !loadSubsectionCollapsed(STORAGE_ZFS_COLLAPSED_KEY);
}

function streamIncludeNetworkIfaces() {
  return panelStreamActive("network") && !loadSubsectionCollapsed(NETWORK_INTERFACES_COLLAPSED_KEY);
}

function streamIncludeListeningPorts() {
  return panelStreamActive("network") && !loadSubsectionCollapsed(NETWORK_LISTEN_PORTS_COLLAPSED_KEY);
}

/** Whether the live stream should collect top processes (server skips work when false). */
function streamIncludeProcesses() {
  return panelStreamActive("processes");
}

/** Whether the server should read diskstats and fill ``disk_io`` (false when Storage / Disk I/O not shown). */
function streamIncludeDiskIo() {
  if (!panelStreamActive("storage")) return false;
  if (loadStorageDiskIoCollapsed()) return false;
  return true;
}

function streamIncludeDockerContainers() {
  return panelStreamActive("containers") && !loadSubsectionCollapsed(DOCKER_CONT_COLLAPSED_KEY);
}

function streamIncludeDockerImages() {
  return panelStreamActive("containers") && !loadSubsectionCollapsed(DOCKER_IMG_COLLAPSED_KEY);
}

function streamIncludeDockerVolumes() {
  return panelStreamActive("containers") && !loadSubsectionCollapsed(DOCKER_VOL_COLLAPSED_KEY);
}

/** Max processes to pull from the server on each snapshot (0 = full machine scan). */
function streamProcSampleLimit() {
  const el = document.getElementById("proc-limit");
  if (!el || el.value === "" || el.value == null) return 200;
  const n = parseInt(el.value, 10);
  if (!Number.isFinite(n) || n < 0) return 200;
  return n;
}

function disconnectMetricsStream() {
  if (metricsEventSource) {
    metricsEventSource.close();
    metricsEventSource = null;
  }
}

function metricsStreamQuerySuffix() {
  const sec = loadUpdateInterval();
  const procs = streamIncludeProcesses();
  const diskIo = streamIncludeDiskIo();
  const procLimit = streamProcSampleLimit();
  const q = new URLSearchParams();
  q.set("interval", String(sec));
  q.set("processes", String(procs));
  q.set("disk_io", String(diskIo));
  q.set("proc_limit", String(procLimit));
  q.set("compute", String(streamIncludeCompute()));
  q.set("network", String(streamIncludeNetworkIfaces()));
  q.set("listening_ports", String(streamIncludeListeningPorts()));
  q.set("thermal", String(streamIncludeThermalSensors()));
  q.set("fans", String(streamIncludeThermalFans()));
  q.set("operations", String(streamIncludeOperations()));
  q.set("mounts", String(streamIncludeDiskMounts()));
  q.set("zfs", String(streamIncludeZfsPools()));
  q.set("docker_containers", String(streamIncludeDockerContainers()));
  q.set("docker_images", String(streamIncludeDockerImages()));
  q.set("docker_volumes", String(streamIncludeDockerVolumes()));
  return q.toString();
}

function connectMetricsStream() {
  disconnectMetricsStream();
  if (loadStreamPaused()) {
    const pill = document.getElementById("conn-pill");
    if (pill) {
      pill.textContent = "paused";
      pill.className = "pill pill-paused";
    }
    return;
  }
  const u = `/api/stream?${metricsStreamQuerySuffix()}`;
  metricsEventSource = new EventSource(u);
  metricsEventSource.onmessage = (ev) => {
    try {
      applySnapshot(JSON.parse(ev.data));
    } catch (_) {
      /* ignore */
    }
  };
  metricsEventSource.onerror = () => {
    const pill = document.getElementById("conn-pill");
    if (pill && !loadStreamPaused()) {
      pill.textContent = "reconnecting…";
      pill.className = "pill pill-warn";
    }
  };
}

window.addEventListener("pagehide", () => disconnectMetricsStream());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    disconnectMetricsStream();
    return;
  }
  if (!loadStreamPaused()) {
    connectMetricsStream();
  }
});

function initUpdateIntervalControl() {
  const pauseChk = document.getElementById("stream-pause");
  if (pauseChk) {
    pauseChk.checked = loadStreamPaused();
    pauseChk.addEventListener("change", () => {
      saveStreamPaused(pauseChk.checked);
      connectMetricsStream();
    });
  }
  const sel = document.getElementById("update-interval-select");
  if (sel) {
    sel.value = String(loadUpdateInterval());
    sel.addEventListener("change", () => {
      const v = parseFloat(sel.value);
      if (!Number.isFinite(v)) return;
      try {
        localStorage.setItem(UPDATE_INTERVAL_KEY, String(snapStreamInterval(v)));
      } catch (_) {
        /* ignore */
      }
      sel.value = String(loadUpdateInterval());
      connectMetricsStream();
    });
  }
  connectMetricsStream();
}

function exportMissionControlSettings() {
  const values = {};
  for (const key of MC_SETTINGS_KEYS) {
    try {
      const v = localStorage.getItem(key);
      if (v != null) values[key] = v;
    } catch (_) {
      /* ignore */
    }
  }
  const payload = {
    format: SETTINGS_EXPORT_FORMAT,
    app: "mission-control",
    exportedAt: new Date().toISOString(),
    values,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mission-control-settings-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeImportedStorageValue(v) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch (_) {
      return null;
    }
  }
  return null;
}

function importMissionControlSettingsFromJsonString(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return { ok: false, error: "File is not valid JSON." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Invalid settings file." };
  }
  let values = null;
  if (parsed.format === SETTINGS_EXPORT_FORMAT && parsed.values && typeof parsed.values === "object") {
    values = parsed.values;
  } else if (parsed.values && typeof parsed.values === "object" && !Array.isArray(parsed.values)) {
    values = parsed.values;
  } else if (!("format" in parsed) && !("app" in parsed) && !("exportedAt" in parsed)) {
    values = parsed;
  }
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {
      ok: false,
      error: "Could not find settings (expected format 1 with a values object, or a flat key map).",
    };
  }
  let count = 0;
  for (const key of Object.keys(values)) {
    if (!MC_SETTINGS_KEY_SET.has(key)) continue;
    const nv = normalizeImportedStorageValue(values[key]);
    if (nv == null) continue;
    try {
      localStorage.setItem(key, nv);
      count += 1;
    } catch (_) {
      return {
        ok: false,
        error: "Could not write to local storage (quota or private mode).",
      };
    }
  }
  if (count === 0) {
    return { ok: false, error: "No recognized Mission Control settings keys in file." };
  }
  return { ok: true };
}

function refreshAllSettingsFromStorage() {
  let themeSaved = "dark";
  try {
    themeSaved = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  } catch (_) {
    /* ignore */
  }
  applyTheme(themeSaved);

  const hi = document.getElementById("header-title-input");
  const hv = document.getElementById("header-title-visible");
  if (hi) hi.value = loadHeaderTitleText();
  if (hv) hv.checked = loadHeaderTitleVisible();
  applyHeaderTitleToDom();

  clockFormatHour12 = loadClockFormat() === "12";
  const clockSel = document.getElementById("clock-format-select");
  if (clockSel) clockSel.value = clockFormatHour12 ? "12" : "24";
  tickClock();

  procMemDisplay = loadProcMemDisplay();
  procMemUnit = loadProcMemUnit();
  const pDisp = document.getElementById("proc-mem-display-select");
  const pUnit = document.getElementById("proc-mem-unit-select");
  if (pDisp) pDisp.value = procMemDisplay;
  if (pUnit) pUnit.value = procMemUnit;
  syncProcMemUnitFieldVisibility();

  procCpuScale = loadProcCpuScale();
  const cpuScaleSel = document.getElementById("proc-cpu-scale-select");
  if (cpuScaleSel) cpuScaleSel.value = procCpuScale;

  const procFooter = document.getElementById("proc-footer-rss-total");
  if (procFooter) procFooter.checked = loadProcFooterRssTotalVisible();

  document.querySelectorAll("#panel-visibility-checks input[type=checkbox]").forEach((input) => {
    const id = input.dataset.panelId;
    if (!id) return;
    const vis = loadPanelVisibility();
    input.checked = vis[id] !== false;
  });
  applyPanelVisibility();

  applyPanelOrder();
  loadPanelCollapsed();

  loadProcSortKeyDir();
  loadDiskSortKeyDir();
  loadNetSortKeyDir();
  loadListenPortsSortKeyDir();
  loadDockerContSortKeyDir();
  loadDockerImgSortKeyDir();
  loadDockerVolSortKeyDir();
  loadThermalSortKeyDir();
  loadFanSortKeyDir();
  applyStorageDiskIoCollapsed();
  applySubsectionCollapsed(
    THERMAL_SENSORS_COLLAPSED_KEY,
    "thermal-sensors-subsection",
    "thermal-sensors-body",
    "Expand Sensors",
    "Collapse Sensors"
  );
  applySubsectionCollapsed(
    THERMAL_FANS_COLLAPSED_KEY,
    "thermal-fans-subsection",
    "thermal-fans-body",
    "Expand Fans",
    "Collapse Fans"
  );
  applySubsectionCollapsed(
    NETWORK_INTERFACES_COLLAPSED_KEY,
    "net-interfaces-subsection",
    "net-interfaces-body",
    "Expand Interfaces",
    "Collapse Interfaces"
  );
  applySubsectionCollapsed(
    NETWORK_LISTEN_PORTS_COLLAPSED_KEY,
    "net-listen-ports-subsection",
    "net-listen-ports-body",
    "Expand Listening ports",
    "Collapse Listening ports"
  );
  applySubsectionCollapsed(
    STORAGE_MOUNTS_COLLAPSED_KEY,
    "storage-mounts-subsection",
    "storage-mounts-body",
    "Expand Mounts",
    "Collapse Mounts"
  );
  applySubsectionCollapsed(
    STORAGE_ZFS_COLLAPSED_KEY,
    "zfs-pools-block",
    "storage-zfs-body",
    "Expand ZFS pools",
    "Collapse ZFS pools"
  );
  applySubsectionCollapsed(
    DOCKER_CONT_COLLAPSED_KEY,
    "docker-containers-subsection",
    "docker-containers-body",
    "Expand Docker containers",
    "Collapse Docker containers"
  );
  applySubsectionCollapsed(
    DOCKER_IMG_COLLAPSED_KEY,
    "docker-images-subsection",
    "docker-images-body",
    "Expand Docker images",
    "Collapse Docker images"
  );
  applySubsectionCollapsed(
    DOCKER_VOL_COLLAPSED_KEY,
    "docker-volumes-subsection",
    "docker-volumes-body",
    "Expand Docker volumes",
    "Collapse Docker volumes"
  );
  netRateUnit = loadNetRateUnit();
  const netRateSel = document.getElementById("net-rate-unit-select");
  if (netRateSel) netRateSel.value = netRateUnit;
  applyProcPrefsToForm();

  aptPackagesExpanded = loadAptPackagesExpanded();
  aptPkgSortDir = loadAptPkgSortDir();
  const aptSearch = document.getElementById("apt-packages-search");
  if (aptSearch) aptSearch.value = loadAptPkgSearch();

  const pauseEl = document.getElementById("stream-pause");
  if (pauseEl) pauseEl.checked = loadStreamPaused();
  const intervalSel = document.getElementById("update-interval-select");
  if (intervalSel) intervalSel.value = String(loadUpdateInterval());

  const mp = loadModalWidthPreset();
  applyModalWidthPreset(mp);
  const modalW = document.getElementById("modal-width-select");
  if (modalW) modalW.value = mp;

  const cl = loadContentLayoutMaxPreset();
  applyContentLayoutMaxPreset(cl);
  const contentMaxSel = document.getElementById("content-layout-max-select");
  if (contentMaxSel) contentMaxSel.value = cl;

  const cp = loadContentPaddingPreset();
  applyContentPaddingPreset(cp);
  const padSel = document.getElementById("content-padding-select");
  if (padSel) padSel.value = cp;

  connectMetricsStream();
  renderProcsTable();
  renderDisks(lastDisks);
  renderZfsPools(lastZfsPools);
  renderNet(lastNetwork);
  loadListenPortsToolbarIntoDom();
  renderListenPortsTableContent();
  renderDiskIo(lastDiskIo);
  renderThermal(lastThermal);
  renderFans(lastFans);
  renderAptPackagesTable();
  syncAptPackagesVisibility();
  renderDockerAll();
}

function initSettingsBackup() {
  const exportBtn = document.getElementById("settings-export-btn");
  const importBtn = document.getElementById("settings-import-btn");
  const fileInput = document.getElementById("settings-import-file");
  exportBtn?.addEventListener("click", () => {
    try {
      exportMissionControlSettings();
    } catch (err) {
      alert(`Export failed: ${err && err.message ? err.message : err}`);
    }
  });
  importBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = importMissionControlSettingsFromJsonString(text);
      if (result.ok) {
        refreshAllSettingsFromStorage();
      } else {
        alert(result.error);
      }
      fileInput.value = "";
    };
    reader.onerror = () => {
      alert("Could not read the selected file.");
      fileInput.value = "";
    };
    reader.readAsText(f);
  });
}

function mergePanelOrder(saved) {
  const known = new Set(PANEL_IDS);
  const seen = new Set();
  const out = [];
  for (const id of saved) {
    if (id === "disk_io") continue;
    if (known.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of PANEL_IDS) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

function loadPanelOrder() {
  try {
    const raw = localStorage.getItem(PANEL_ORDER_KEY);
    if (!raw) return [...PANEL_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...PANEL_IDS];
    return mergePanelOrder(parsed);
  } catch (_) {
    return [...PANEL_IDS];
  }
}

function applyPanelOrder() {
  const main = document.querySelector("main.mc-grid");
  if (!main) return;
  const order = loadPanelOrder();
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const el = main.querySelector(`section.panel[data-panel-id="${order[i]}"]`);
    if (el) main.prepend(el);
  }
}

function savePanelOrder() {
  const main = document.querySelector("main.mc-grid");
  if (!main) return;
  const order = [...main.querySelectorAll("section.panel[data-panel-id]")].map(
    (s) => s.dataset.panelId
  );
  try {
    localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(order));
  } catch (_) {
    /* ignore */
  }
}

function getDragAfterElement(container, y) {
  const others = [...container.querySelectorAll("section.panel[data-panel-id]:not([hidden])")].filter(
    (el) => !el.classList.contains("is-dragging")
  );
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const child of others) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  }
  return closest.element;
}

function syncPanelCollapsedUi(section) {
  const titleEl = section.querySelector(".panel-title");
  const body = section.querySelector(".panel-body");
  const name = titleEl ? titleEl.textContent.trim() : "section";
  const collapsed = section.classList.contains("is-collapsed");
  if (body) {
    body.hidden = collapsed;
    body.setAttribute("aria-hidden", String(collapsed));
  }
  if (titleEl) {
    titleEl.setAttribute("aria-expanded", String(!collapsed));
    titleEl.setAttribute("aria-label", collapsed ? `Expand ${name}` : `Collapse ${name}`);
  }
}

function loadPanelCollapsed() {
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(PANEL_COLLAPSED_KEY) || "{}");
  } catch (_) {
    map = {};
  }
  document.querySelectorAll("section.panel[data-panel-id]").forEach((section) => {
    const id = section.dataset.panelId;
    section.classList.toggle("is-collapsed", !!(id && map[id]));
    syncPanelCollapsedUi(section);
  });
}

function togglePanelCollapse(section) {
  section.classList.toggle("is-collapsed");
  const id = section.dataset.panelId;
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(PANEL_COLLAPSED_KEY) || "{}");
  } catch (_) {
    map = {};
  }
  if (section.classList.contains("is-collapsed")) map[id] = true;
  else delete map[id];
  try {
    localStorage.setItem(PANEL_COLLAPSED_KEY, JSON.stringify(map));
  } catch (_) {
    /* ignore */
  }
  syncPanelCollapsedUi(section);
  connectMetricsStream();
}

function initPanelLayout() {
  applyPanelOrder();
  loadPanelCollapsed();

  const main = document.querySelector("main.mc-grid");
  if (!main) return;

  main.querySelectorAll("section.panel[data-panel-id]").forEach((section) => {
    const handle = section.querySelector(".panel-drag");
    const panelTitle = section.querySelector(".panel-title");
    const panelId = section.dataset.panelId;

    if (handle) {
      handle.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", panelId);
        section.classList.add("is-dragging");
      });
      handle.addEventListener("dragend", () => {
        section.classList.remove("is-dragging");
      });
    }

    if (panelTitle && panelTitle.dataset.panelCollapseBound !== "1") {
      panelTitle.dataset.panelCollapseBound = "1";
      const body = section.querySelector(".panel-body");
      if (body && body.id) {
        panelTitle.setAttribute("aria-controls", body.id);
      }
      const onToggle = () => togglePanelCollapse(section);
      panelTitle.addEventListener("click", onToggle);
      panelTitle.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onToggle();
      });
    }
  });

  main.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  main.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const dragged = main.querySelector(`section.panel[data-panel-id="${id}"]`);
    if (!dragged) return;
    const after = getDragAfterElement(main, e.clientY);
    if (after == null) main.appendChild(dragged);
    else main.insertBefore(dragged, after);
    savePanelOrder();
  });
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const d = i === 0 ? 0 : v < 10 ? 1 : v < 100 ? 1 : 0;
  return `${v.toFixed(d)} ${units[i]}`;
}

const NET_RATE_UNIT_KEY = "mc-net-rate-unit";
/** @type {"mbytes"|"mbits"|"both"} */
let netRateUnit = "mbytes";

function loadNetRateUnit() {
  try {
    const raw = localStorage.getItem(NET_RATE_UNIT_KEY);
    if (raw === "mbits") return "mbits";
    if (raw === "both") return "both";
    return "mbytes";
  } catch (_) {
    return "mbytes";
  }
}

function normalizeNetRateUnitSelect(v) {
  if (v === "mbits" || v === "both") return v;
  return "mbytes";
}

/** @param {number} v bytes per second */
function formatNetRateAsBytes(v) {
  return `${formatBytes(v)}/s`.replace(" B/", " B/s").replace("/s/s", "/s");
}

/** @param {number} v bytes per second */
function formatNetRateAsMbits(v) {
  const bitsPerSec = v * 8;
  if (bitsPerSec <= 0 && v === 0) return "0 Mbps";
  const mbps = bitsPerSec / 1e6;
  if (mbps < 0.001) {
    const kbps = bitsPerSec / 1e3;
    return `${kbps.toFixed(2)} Kbps`;
  }
  if (mbps < 10) return `${mbps.toFixed(2)} Mbps`;
  if (mbps < 100) return `${mbps.toFixed(1)} Mbps`;
  return `${mbps.toFixed(0)} Mbps`;
}

function formatNetRate(bps) {
  if (bps == null || !Number.isFinite(Number(bps))) return "—";
  const v = Number(bps);
  if (netRateUnit === "mbits") {
    return formatNetRateAsMbits(v);
  }
  if (netRateUnit === "both") {
    return `${formatNetRateAsBytes(v)} · ${formatNetRateAsMbits(v)}`;
  }
  return formatNetRateAsBytes(v);
}

function formatBytesPerSec(bps) {
  if (bps == null || !Number.isFinite(Number(bps))) return "—";
  return formatNetRateAsBytes(Number(bps));
}

function formatUptime(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor((sec / 3600) % 24);
  const d = Math.floor(sec / 86400);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function diskClass(pct) {
  if (pct >= 95) return "pct-crit";
  if (pct >= 85) return "pct-warn";
  return "";
}

const DISK_SORT_KEYDIR_KEY = "mc-disk-sort-keydir";

/** @type {"device"|"mountpoint"|"fstype"|"percent"|"used"|"free"|"total"|"inode_percent"} */
let diskSortColumn = "mountpoint";
/** @type {"asc"|"desc"} */
let diskSortDir = "asc";

function normalizeDiskSortColumn(k) {
  const allowed = [
    "mountpoint",
    "device",
    "fstype",
    "percent",
    "used",
    "free",
    "total",
    "inode_percent",
  ];
  return allowed.includes(k) ? k : "mountpoint";
}

function loadDiskSortKeyDir() {
  try {
    const raw = localStorage.getItem(DISK_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        diskSortColumn = normalizeDiskSortColumn(o.column || o.key);
        diskSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveDiskSortKeyDir() {
  try {
    localStorage.setItem(
      DISK_SORT_KEYDIR_KEY,
      JSON.stringify({ column: diskSortColumn, dir: diskSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function onDiskColumnHeaderClick(key) {
  const k = normalizeDiskSortColumn(key);
  if (diskSortColumn === k) {
    diskSortDir = diskSortDir === "asc" ? "desc" : "asc";
  } else {
    diskSortColumn = k;
    diskSortDir =
      k === "mountpoint" || k === "device" || k === "fstype" ? "asc" : "desc";
  }
  saveDiskSortKeyDir();
  renderDisks(lastDisks);
}

function diskSortAriaSort(col) {
  if (diskSortColumn !== col) return "none";
  return diskSortDir === "asc" ? "ascending" : "descending";
}

function diskSortArrowHtml(col) {
  if (diskSortColumn !== col) return "";
  const ch = diskSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind disk-sort-ind" aria-hidden="true">${ch}</span>`;
}

function cmpDiskRows(a, b) {
  const dir = diskSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (diskSortColumn) {
    case "mountpoint":
      cmp = String(a.mountpoint || "").localeCompare(String(b.mountpoint || ""));
      break;
    case "device":
      cmp = String(a.device || "").localeCompare(String(b.device || ""));
      break;
    case "fstype":
      cmp = String(a.fstype || "").localeCompare(String(b.fstype || ""));
      break;
    case "percent":
      cmp = (Number(a.percent) || 0) - (Number(b.percent) || 0);
      break;
    case "used":
      cmp = (Number(a.used) || 0) - (Number(b.used) || 0);
      break;
    case "free":
      cmp = (Number(a.free) || 0) - (Number(b.free) || 0);
      break;
    case "total":
      cmp = (Number(a.total) || 0) - (Number(b.total) || 0);
      break;
    case "inode_percent": {
      const ai = a.inode_percent != null ? Number(a.inode_percent) : NaN;
      const bi = b.inode_percent != null ? Number(b.inode_percent) : NaN;
      if (!Number.isFinite(ai) && !Number.isFinite(bi)) cmp = 0;
      else if (!Number.isFinite(ai)) cmp = 1;
      else if (!Number.isFinite(bi)) cmp = -1;
      else cmp = ai - bi;
      break;
    }
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.mountpoint || "").localeCompare(String(b.mountpoint || ""));
}

let lastDisks = [];
let lastZfsPools = [];
let lastNetwork = null;
let lastListeningPorts = null;
let lastDocker = null;
let lastDiskIo = null;
let lastThermal = null;
let lastFans = null;

function initDiskSortHeaderClicks() {
  const host = document.getElementById("panel-body-storage");
  if (!host || host.dataset.diskSortBound === "1") return;
  host.dataset.diskSortBound = "1";
  host.addEventListener("click", (e) => {
    const th = e.target.closest("th.disk-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    onDiskColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const th = e.target.closest("th.disk-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    e.preventDefault();
    onDiskColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
}

function initDiskRowClicks() {
  const wrap = document.getElementById("disk-table");
  if (!wrap || wrap.dataset.diskRowDetailBound === "1") return;
  wrap.dataset.diskRowDetailBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.disk-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    const enc = tr.getAttribute("data-mp") || "";
    let mp = "";
    try {
      mp = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!mp) return;
    openDiskDetailModal(mp);
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.disk-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const enc = tr.getAttribute("data-mp") || "";
    let mp = "";
    try {
      mp = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!mp) return;
    openDiskDetailModal(mp);
  });
}

function loadSubsectionCollapsed(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch (_) {
    return false;
  }
}

function saveSubsectionCollapsed(key, on) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch (_) {
    /* ignore */
  }
}

function applySubsectionCollapsed(key, subsectionId, bodyId, expandLabel, collapseLabel) {
  const subsection = document.getElementById(subsectionId);
  const body = document.getElementById(bodyId);
  const head = subsection?.querySelector(".storage-subsection-head");
  if (!subsection || !body || !head) return;
  subsection.classList.toggle("is-collapsed", loadSubsectionCollapsed(key));
  const collapsed = subsection.classList.contains("is-collapsed");
  head.setAttribute("aria-expanded", String(!collapsed));
  head.setAttribute("aria-label", collapsed ? expandLabel : collapseLabel);
  body.hidden = collapsed;
  body.setAttribute("aria-hidden", String(collapsed));
}

function toggleSubsectionCollapsed(key, subsectionId, bodyId, expandLabel, collapseLabel, onToggle) {
  const subsection = document.getElementById(subsectionId);
  const body = document.getElementById(bodyId);
  const head = subsection?.querySelector(".storage-subsection-head");
  if (!subsection || !body || !head) return;
  const collapsed = !subsection.classList.contains("is-collapsed");
  subsection.classList.toggle("is-collapsed", collapsed);
  saveSubsectionCollapsed(key, collapsed);
  head.setAttribute("aria-expanded", String(!collapsed));
  head.setAttribute("aria-label", collapsed ? expandLabel : collapseLabel);
  body.hidden = collapsed;
  body.setAttribute("aria-hidden", String(collapsed));
  if (typeof onToggle === "function") onToggle();
}

function initSubsectionCollapse(key, subsectionId, bodyId, expandLabel, collapseLabel, bindAttr, onToggle) {
  const subsection = document.getElementById(subsectionId);
  const head = subsection?.querySelector(".storage-subsection-head");
  const body = document.getElementById(bodyId);
  if (!subsection || !head || !body || head.dataset[bindAttr] === "1") return;
  head.dataset[bindAttr] = "1";
  head.setAttribute("role", "button");
  head.tabIndex = 0;
  head.setAttribute("aria-controls", bodyId);
  const go = () =>
    toggleSubsectionCollapsed(key, subsectionId, bodyId, expandLabel, collapseLabel, onToggle);
  head.addEventListener("click", go);
  head.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    go();
  });
}

function loadStorageDiskIoCollapsed() {
  return loadSubsectionCollapsed(STORAGE_DISK_IO_COLLAPSED_KEY);
}

function applyStorageDiskIoCollapsed() {
  applySubsectionCollapsed(
    STORAGE_DISK_IO_COLLAPSED_KEY,
    "storage-disk-io-subsection",
    "storage-disk-io-body",
    "Expand Disk I/O",
    "Collapse Disk I/O"
  );
}

function initStoragePanel() {
  loadDiskSortKeyDir();
  loadDiskIoSortKeyDir();
  initDiskSortHeaderClicks();
  initDiskIoSortHeaderClicks();
  initDiskRowClicks();
  initDiskIoRowClicks();
  initZpoolRowClicks();
  applySubsectionCollapsed(
    STORAGE_MOUNTS_COLLAPSED_KEY,
    "storage-mounts-subsection",
    "storage-mounts-body",
    "Expand Mounts",
    "Collapse Mounts"
  );
  applySubsectionCollapsed(
    STORAGE_ZFS_COLLAPSED_KEY,
    "zfs-pools-block",
    "storage-zfs-body",
    "Expand ZFS pools",
    "Collapse ZFS pools"
  );
  applyStorageDiskIoCollapsed();
  initSubsectionCollapse(
    STORAGE_MOUNTS_COLLAPSED_KEY,
    "storage-mounts-subsection",
    "storage-mounts-body",
    "Expand Mounts",
    "Collapse Mounts",
    "mountsSubCollapseBound",
    connectMetricsStream
  );
  initSubsectionCollapse(
    STORAGE_ZFS_COLLAPSED_KEY,
    "zfs-pools-block",
    "storage-zfs-body",
    "Expand ZFS pools",
    "Collapse ZFS pools",
    "zfsSubCollapseBound",
    connectMetricsStream
  );
  initSubsectionCollapse(
    STORAGE_DISK_IO_COLLAPSED_KEY,
    "storage-disk-io-subsection",
    "storage-disk-io-body",
    "Expand Disk I/O",
    "Collapse Disk I/O",
    "diskIoSubCollapseBound",
    connectMetricsStream
  );
}

const DISK_DETAIL_PRIORITY = [
  "mountpoint",
  "device",
  "fstype",
  "mount_options",
  "zfs_pool",
  "zfs_dataset",
  "total",
  "used",
  "free",
  "percent",
  "inode_percent",
  "zfs_properties",
  "statvfs",
  "ts",
];

function formatDiskDetailScalar(key, val) {
  if (val == null) return "—";
  if (key === "total" || key === "used" || key === "free") {
    if (typeof val === "number" && Number.isFinite(val)) return formatBytes(val);
  }
  if (key === "percent" || key === "inode_percent") {
    if (typeof val === "number" && Number.isFinite(val)) return `${val.toFixed(1)}%`;
  }
  if (key === "ts" && typeof val === "number") {
    try {
      return `${val} (${new Date(val * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })})`;
    } catch (_) {
      return String(val);
    }
  }
  if (key === "statvfs" && val && typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch (_) {
      return String(val);
    }
  }
  if (key === "zfs_properties" && val && typeof val === "object") {
    try {
      return Object.keys(val)
        .sort()
        .map((p) => `${p}: ${val[p]}`)
        .join("\n");
    } catch (_) {
      return String(val);
    }
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

function renderDiskDetailHtml(data) {
  if (!data) return "<p class=\"tile-meta\">No data.</p>";
  const skipRest = new Set(["error"]);
  const shown = new Set();
  let html = "<dl class=\"proc-detail-dl\">";
  for (const k of DISK_DETAIL_PRIORITY) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    const v = data[k];
    if (v == null && k !== "percent") continue;
    if (k === "statvfs" && v && typeof v === "object") {
      shown.add(k);
      html += `<dt>${escapeHtml(k)}</dt><dd><pre class="proc-detail-json proc-detail-json-inline">${escapeHtml(
        formatDiskDetailScalar(k, v)
      )}</pre></dd>`;
      continue;
    }
    if (k === "zfs_properties" && v && typeof v === "object") {
      shown.add(k);
      html += `<dt>ZFS properties</dt><dd><pre class="proc-detail-json proc-detail-json-inline">${escapeHtml(
        formatDiskDetailScalar(k, v)
      )}</pre></dd>`;
      continue;
    }
    shown.add(k);
    html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(formatDiskDetailScalar(k, v))}</dd>`;
  }
  const restKeys = Object.keys(data).filter((k) => !shown.has(k) && !skipRest.has(k));
  restKeys.sort();
  for (const k of restKeys) {
    const v = data[k];
    if (v == null) continue;
    html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(formatDiskDetailScalar(k, v))}</dd>`;
  }
  html += "</dl>";
  html +=
    "<details class=\"proc-detail-raw\"><summary>All fields (JSON)</summary>" +
    `<pre class="proc-detail-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
  return html;
}

function closeDiskDetailModal() {
  const backdrop = document.getElementById("disk-detail-backdrop");
  const dialog = document.getElementById("disk-detail-dialog");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
  }
}

function openDiskDetailModal(mountpoint) {
  const backdrop = document.getElementById("disk-detail-backdrop");
  const dialog = document.getElementById("disk-detail-dialog");
  const body = document.getElementById("disk-detail-body");
  const title = document.getElementById("disk-detail-title");
  if (!backdrop || !dialog || !body || !title) return;

  title.textContent = mountpoint;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");

  document.getElementById("disk-detail-close")?.focus();

  const q = encodeURIComponent(mountpoint);
  fetch(`/api/mount?mountpoint=${q}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Mount not available.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = d.mountpoint || mountpoint;
      body.innerHTML = renderDiskDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = mountpoint;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function initDiskDetailModal() {
  const backdrop = document.getElementById("disk-detail-backdrop");
  const closeBtn = document.getElementById("disk-detail-close");
  closeBtn?.addEventListener("click", closeDiskDetailModal);
  backdrop?.addEventListener("click", closeDiskDetailModal);
}

const BLOCK_DEV_DETAIL_PRIORITY = [
  "devname",
  "devpath",
  "smart_target_devname",
  "smart_devpath",
  "diskstats",
  "sysfs",
  "ts",
];

function renderSmartDetailHtml(s) {
  if (!s || typeof s !== "object") return "<p class=\"tile-meta\">—</p>";
  const parts = [];
  if (s.health_passed === true) {
    parts.push("<p class=\"ops-ok\"><strong>SMART health:</strong> PASSED</p>");
  } else if (s.health_passed === false) {
    parts.push("<p class=\"pct-crit\"><strong>SMART health:</strong> FAILED</p>");
  } else {
    parts.push("<p><strong>SMART health:</strong> —</p>");
  }
  if (s.message) {
    parts.push(`<p class="tile-meta block-dev-smart-msg">${escapeHtml(s.message)}</p>`);
  }
  const rows = [];
  if (s.exit_status != null && s.exit_status !== "") {
    rows.push(
      `<tr><th scope="row">smartctl exit</th><td><code>${escapeHtml(String(s.exit_status))}</code> <span class="tile-meta">(0 = ok; 2 = error)</span></td></tr>`
    );
  }
  if (s.model_name) rows.push(`<tr><th scope="row">Model</th><td>${escapeHtml(s.model_name)}</td></tr>`);
  if (s.serial_number) rows.push(`<tr><th scope="row">Serial</th><td>${escapeHtml(s.serial_number)}</td></tr>`);
  if (s.firmware_version) {
    rows.push(`<tr><th scope="row">Firmware</th><td>${escapeHtml(s.firmware_version)}</td></tr>`);
  }
  if (s.temperature_c != null && Number.isFinite(Number(s.temperature_c))) {
    rows.push(
      `<tr><th scope="row">Temperature</th><td>${escapeHtml(String(s.temperature_c))} °C</td></tr>`
    );
  }
  if (s.power_on_hours != null && Number.isFinite(Number(s.power_on_hours))) {
    rows.push(
      `<tr><th scope="row">Power-on hours</th><td>${escapeHtml(String(s.power_on_hours))}</td></tr>`
    );
  }
  if (s.nvme_critical_warning != null) {
    rows.push(
      `<tr><th scope="row">NVMe critical warning</th><td>${escapeHtml(String(s.nvme_critical_warning))}</td></tr>`
    );
  }
  if (s.user_capacity_bytes != null && Number.isFinite(Number(s.user_capacity_bytes))) {
    rows.push(
      `<tr><th scope="row">Capacity</th><td>${escapeHtml(formatBytes(s.user_capacity_bytes))}</td></tr>`
    );
  }
  if (rows.length) {
    parts.push(`<table class="block-dev-smart-table"><tbody>${rows.join("")}</tbody></table>`);
  }
  if (s.smartctl_found === false && !s.message) {
    parts.push("<p class=\"tile-meta\">smartctl not found on PATH (install smartmontools).</p>");
  }
  if (s.attributes_excerpt) {
    parts.push(
      `<details open class="proc-detail-raw"><summary>SMART attributes</summary><pre class="proc-detail-json">${escapeHtml(
        s.attributes_excerpt
      )}</pre></details>`
    );
  }
  if (s.raw_excerpt) {
    parts.push(
      `<details class="proc-detail-raw"><summary>smartctl output</summary><pre class="proc-detail-json">${escapeHtml(
        s.raw_excerpt
      )}</pre></details>`
    );
  }
  return parts.join("");
}

function renderBlockDevDetailHtml(data) {
  if (!data) return "<p class=\"tile-meta\">No data.</p>";
  const skipRest = new Set(["error", "smart"]);
  const shown = new Set();
  let html = "<dl class=\"proc-detail-dl\">";
  for (const k of BLOCK_DEV_DETAIL_PRIORITY) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    const v = data[k];
    if (v == null && k !== "diskstats") continue;
    if ((k === "sysfs" || k === "diskstats") && v && typeof v === "object") {
      shown.add(k);
      html += `<dt>${escapeHtml(k)}</dt><dd><pre class="proc-detail-json proc-detail-json-inline">${escapeHtml(
        JSON.stringify(v, null, 2)
      )}</pre></dd>`;
      continue;
    }
    shown.add(k);
    html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`;
  }
  if (data.smart && typeof data.smart === "object") {
    shown.add("smart");
    html += `<dt>SMART</dt><dd class="block-dev-smart-dd">${renderSmartDetailHtml(data.smart)}</dd>`;
  }
  const restKeys = Object.keys(data).filter((k) => !shown.has(k) && !skipRest.has(k));
  restKeys.sort();
  for (const k of restKeys) {
    const v = data[k];
    if (v == null) continue;
    if (typeof v === "object") {
      html += `<dt>${escapeHtml(k)}</dt><dd><pre class="proc-detail-json proc-detail-json-inline">${escapeHtml(
        JSON.stringify(v, null, 2)
      )}</pre></dd>`;
    } else {
      html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`;
    }
  }
  html += "</dl>";
  html +=
    "<details class=\"proc-detail-raw\"><summary>All fields (JSON)</summary>" +
    `<pre class="proc-detail-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
  return html;
}

function closeBlockDevDetailModal() {
  const backdrop = document.getElementById("block-dev-detail-backdrop");
  const dialog = document.getElementById("block-dev-detail-dialog");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
  }
}

function openBlockDevDetailModal(devname) {
  const backdrop = document.getElementById("block-dev-detail-backdrop");
  const dialog = document.getElementById("block-dev-detail-dialog");
  const body = document.getElementById("block-dev-detail-body");
  const title = document.getElementById("block-dev-detail-title");
  if (!backdrop || !dialog || !body || !title) return;

  title.textContent = devname;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");

  document.getElementById("block-dev-detail-close")?.focus();

  const enc = encodeURIComponent(devname);
  fetch(`/api/block/${enc}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Block device not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = d.devname || devname;
      body.innerHTML = renderBlockDevDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = devname;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function initBlockDevDetailModal() {
  const backdrop = document.getElementById("block-dev-detail-backdrop");
  const closeBtn = document.getElementById("block-dev-detail-close");
  closeBtn?.addEventListener("click", closeBlockDevDetailModal);
  backdrop?.addEventListener("click", closeBlockDevDetailModal);
}

const ZPOOL_DETAIL_PRIORITY = [
  "pool",
  "state",
  "health",
  "capacity_percent",
  "allocated",
  "free",
  "size",
  "fragmentation_percent",
  "scan",
  "errors",
  "status_text",
  "properties",
  "ts",
];

function formatZpoolDetailScalar(key, val) {
  if (val == null) return "—";
  if (key === "size" || key === "allocated" || key === "free") {
    if (typeof val === "number" && Number.isFinite(val)) return formatBytes(val);
  }
  if (key === "capacity_percent" || key === "fragmentation_percent") {
    if (typeof val === "number" && Number.isFinite(val)) return `${val.toFixed(1)}%`;
  }
  if (key === "ts" && typeof val === "number") {
    try {
      return `${val} (${new Date(val * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })})`;
    } catch (_) {
      return String(val);
    }
  }
  if (key === "status_text" && typeof val === "string") return val;
  if (key === "properties" && val && typeof val === "object") {
    try {
      return Object.keys(val)
        .sort()
        .map((p) => `${p}: ${val[p]}`)
        .join("\n");
    } catch (_) {
      return String(val);
    }
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

function renderZpoolDetailHtml(data) {
  if (!data) return "<p class=\"tile-meta\">No data.</p>";
  const shown = new Set();
  let html = "<dl class=\"proc-detail-dl\">";
  for (const k of ZPOOL_DETAIL_PRIORITY) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    const v = data[k];
    if (v == null && k !== "capacity_percent" && k !== "health") continue;
    if (k === "status_text" && v && typeof v === "string") {
      shown.add(k);
      html += `<dt>zpool status</dt><dd><pre class="proc-detail-json proc-detail-zpool-status">${escapeHtml(v)}</pre></dd>`;
      continue;
    }
    if (k === "properties" && v && typeof v === "object") {
      shown.add(k);
      html += `<dt>Pool properties</dt><dd><pre class="proc-detail-json proc-detail-json-inline">${escapeHtml(
        formatZpoolDetailScalar(k, v)
      )}</pre></dd>`;
      continue;
    }
    shown.add(k);
    html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(formatZpoolDetailScalar(k, v))}</dd>`;
  }
  html += "</dl>";
  html +=
    "<details class=\"proc-detail-raw\"><summary>All fields (JSON)</summary>" +
    `<pre class="proc-detail-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
  return html;
}

function closeZpoolDetailModal() {
  const backdrop = document.getElementById("zpool-detail-backdrop");
  const dialog = document.getElementById("zpool-detail-dialog");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
  }
}

function openZpoolDetailModal(poolName) {
  const backdrop = document.getElementById("zpool-detail-backdrop");
  const dialog = document.getElementById("zpool-detail-dialog");
  const body = document.getElementById("zpool-detail-body");
  const title = document.getElementById("zpool-detail-title");
  if (!backdrop || !dialog || !body || !title) return;

  title.textContent = poolName;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");

  document.getElementById("zpool-detail-close")?.focus();

  const seg = encodeURIComponent(poolName);
  fetch(`/api/zpool/${seg}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Pool not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = d.pool || poolName;
      body.innerHTML = renderZpoolDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = poolName;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function initZpoolDetailModal() {
  const backdrop = document.getElementById("zpool-detail-backdrop");
  const closeBtn = document.getElementById("zpool-detail-close");
  closeBtn?.addEventListener("click", closeZpoolDetailModal);
  backdrop?.addEventListener("click", closeZpoolDetailModal);
}

function initZpoolRowClicks() {
  const wrap = document.getElementById("zfs-pools-table");
  if (!wrap || wrap.dataset.zpoolRowBound === "1") return;
  wrap.dataset.zpoolRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.zfs-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    const enc = tr.getAttribute("data-pool") || "";
    let name = "";
    try {
      name = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!name) return;
    openZpoolDetailModal(name);
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.zfs-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const enc = tr.getAttribute("data-pool") || "";
    let name = "";
    try {
      name = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!name) return;
    openZpoolDetailModal(name);
  });
}

function closeNetDetailModal() {
  const backdrop = document.getElementById("net-detail-backdrop");
  const dialog = document.getElementById("net-detail-dialog");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
  }
}

const NET_IF_DETAIL_PRIORITY = ["rates_bps", "stats", "addresses", "io_counters", "sysfs", "ts"];

const NET_IF_DETAIL_LABELS = {
  rates_bps: "Throughput (last sample)",
  stats: "Link (psutil)",
  addresses: "Addresses",
  io_counters: "Totals since boot",
  sysfs: "/sys/class/net",
  ts: "Queried at",
};

function formatNetIfDetailScalar(key, val) {
  if (val == null) return "—";
  if (key === "ts" && typeof val === "number") {
    try {
      return `${val} (${new Date(val * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })})`;
    } catch (_) {
      return String(val);
    }
  }
  if (key === "rates_bps" && val && typeof val === "object") {
    const d = Number(val.recv_bps);
    const u = Number(val.sent_bps);
    return `Down ${formatNetRate(d)} · Up ${formatNetRate(u)}`;
  }
  if (key === "addresses" && Array.isArray(val)) {
    if (!val.length) return "—";
    return val
      .map((a) => {
        const bits = [
          a.family,
          a.address || null,
          a.netmask ? `mask ${a.netmask}` : null,
          a.broadcast ? `brd ${a.broadcast}` : null,
          a.ptp ? `ptp ${a.ptp}` : null,
        ].filter(Boolean);
        return bits.join(" · ");
      })
      .join("\n");
  }
  if (key === "io_counters" && val && typeof val === "object") {
    const lines = [];
    if (val.bytes_recv != null) lines.push(`Bytes recv: ${formatBytes(val.bytes_recv)}`);
    if (val.bytes_sent != null) lines.push(`Bytes sent: ${formatBytes(val.bytes_sent)}`);
    if (val.packets_recv != null) lines.push(`Packets recv: ${val.packets_recv}`);
    if (val.packets_sent != null) lines.push(`Packets sent: ${val.packets_sent}`);
    if (val.errin != null) lines.push(`Errors in: ${val.errin}`);
    if (val.errout != null) lines.push(`Errors out: ${val.errout}`);
    if (val.dropin != null) lines.push(`Dropped in: ${val.dropin}`);
    if (val.dropout != null) lines.push(`Dropped out: ${val.dropout}`);
    return lines.length ? lines.join("\n") : "—";
  }
  if (key === "stats" && val && typeof val === "object") {
    const lines = [];
    if (val.isup !== undefined) lines.push(`Up: ${val.isup ? "yes" : "no"}`);
    if (val.duplex != null && String(val.duplex)) lines.push(`Duplex: ${val.duplex}`);
    if (val.speed != null) {
      if (Number(val.speed) > 0) lines.push(`Speed: ${val.speed} Mb/s`);
      else lines.push("Speed: unknown");
    }
    if (val.mtu != null) lines.push(`MTU: ${val.mtu}`);
    if (val.flags != null && String(val.flags)) lines.push(`Flags: ${val.flags}`);
    return lines.length ? lines.join("\n") : "—";
  }
  if (key === "sysfs" && val && typeof val === "object") {
    const keys = Object.keys(val).sort();
    if (!keys.length) return "—";
    return keys.map((k) => `${k}: ${val[k]}`).join("\n");
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

function renderNetInterfaceDetailHtml(data) {
  if (!data) return "<p class=\"tile-meta\">No data.</p>";
  const shown = new Set();
  const preKeys = new Set(["addresses", "io_counters", "stats", "sysfs"]);
  let html = "<dl class=\"proc-detail-dl\">";
  for (const k of NET_IF_DETAIL_PRIORITY) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    const v = data[k];
    if (v == null && k !== "stats") continue;
    const label = NET_IF_DETAIL_LABELS[k] || k;
    if (preKeys.has(k)) {
      shown.add(k);
      const content = formatNetIfDetailScalar(k, v);
      html += `<dt>${escapeHtml(label)}</dt><dd><pre class="proc-detail-json proc-detail-json-inline">${escapeHtml(
        content
      )}</pre></dd>`;
      continue;
    }
    shown.add(k);
    html += `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(formatNetIfDetailScalar(k, v))}</dd>`;
  }
  const skipRest = new Set(["ifname", ...shown]);
  const restKeys = Object.keys(data).filter((k) => !skipRest.has(k));
  restKeys.sort();
  for (const k of restKeys) {
    const v = data[k];
    if (v == null) continue;
    html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(formatNetIfDetailScalar(k, v))}</dd>`;
  }
  html += "</dl>";
  html +=
    "<details class=\"proc-detail-raw\"><summary>All fields (JSON)</summary>" +
    `<pre class="proc-detail-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
  return html;
}

function openNetDetailModal(ifname) {
  const backdrop = document.getElementById("net-detail-backdrop");
  const dialog = document.getElementById("net-detail-dialog");
  const body = document.getElementById("net-detail-body");
  const title = document.getElementById("net-detail-title");
  if (!backdrop || !dialog || !body || !title) return;

  title.textContent = ifname;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");

  document.getElementById("net-detail-close")?.focus();

  const seg = encodeURIComponent(ifname);
  fetch(`/api/net/interface/${seg}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Interface not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = d.ifname || ifname;
      body.innerHTML = renderNetInterfaceDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = ifname;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function initNetDetailModal() {
  const backdrop = document.getElementById("net-detail-backdrop");
  const closeBtn = document.getElementById("net-detail-close");
  closeBtn?.addEventListener("click", closeNetDetailModal);
  backdrop?.addEventListener("click", closeNetDetailModal);
}

function initNetInterfaceRowClicks() {
  const wrap = document.getElementById("net-table");
  if (!wrap || wrap.dataset.netIfaceRowBound === "1") return;
  wrap.dataset.netIfaceRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.net-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    const enc = tr.getAttribute("data-ifname") || "";
    let name = "";
    try {
      name = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!name) return;
    openNetDetailModal(name);
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.net-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const enc = tr.getAttribute("data-ifname") || "";
    let name = "";
    try {
      name = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!name) return;
    openNetDetailModal(name);
  });
}

function initModalEscapeToClose() {
  if (initModalEscapeToClose.done) return;
  initModalEscapeToClose.done = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const thermalDlg = document.getElementById("thermal-detail-dialog");
    if (thermalDlg && !thermalDlg.hidden) {
      closeThermalDetailModal();
      return;
    }
    const blockDevDlg = document.getElementById("block-dev-detail-dialog");
    if (blockDevDlg && !blockDevDlg.hidden) {
      closeBlockDevDetailModal();
      return;
    }
    const dockerDlg = document.getElementById("docker-detail-dialog");
    if (dockerDlg && !dockerDlg.hidden) {
      closeDockerDetailModal();
      return;
    }
    const netDlg = document.getElementById("net-detail-dialog");
    if (netDlg && !netDlg.hidden) {
      closeNetDetailModal();
      return;
    }
    const zpoolDlg = document.getElementById("zpool-detail-dialog");
    if (zpoolDlg && !zpoolDlg.hidden) {
      closeZpoolDetailModal();
      return;
    }
    const diskDlg = document.getElementById("disk-detail-dialog");
    if (diskDlg && !diskDlg.hidden) {
      closeDiskDetailModal();
      return;
    }
    const procDlg = document.getElementById("proc-detail-dialog");
    if (procDlg && !procDlg.hidden) closeProcessDetailModal();
  });
}
initModalEscapeToClose.done = false;

function zfsPoolHealthClass(health) {
  const s = String(health || "").toUpperCase();
  if (s === "ONLINE") return "";
  if (s === "DEGRADED" || s === "SUSPENDED") return "pct-warn";
  if (
    s === "FAULTED" ||
    s === "OFFLINE" ||
    s === "UNAVAIL" ||
    s === "REMOVED" ||
    s === "CLOSED"
  ) {
    return "pct-crit";
  }
  return s ? "pct-warn" : "";
}

function renderZfsPools(pools) {
  const block = document.getElementById("zfs-pools-block");
  const host = document.getElementById("zfs-pools-table");
  if (!block || !host) return;
  if (!Array.isArray(pools) || pools.length === 0) {
    block.hidden = true;
    host.innerHTML = "";
    return;
  }
  block.hidden = false;
  let sumAlloc = 0;
  let sumFree = 0;
  let sumSize = 0;
  for (const p of pools) {
    const a = Number(p.allocated);
    const f = Number(p.free);
    const s = Number(p.size);
    if (Number.isFinite(a)) sumAlloc += a;
    if (Number.isFinite(f)) sumFree += f;
    if (Number.isFinite(s)) sumSize += s;
  }
  const aggCap = sumSize > 0 ? (100 * sumAlloc) / sumSize : NaN;
  const aggCapDisp = Number.isFinite(aggCap) ? `${aggCap.toFixed(1)}%` : "—";
  const aggCapClass = Number.isFinite(aggCap) ? diskClass(aggCap) : "";
  const foot = `<tfoot><tr class="zfs-tfoot-row">
      <td class="zfs-td-name zfs-tfoot-label" colspan="3">Total · ${pools.length} pools</td>
      <td class="zfs-td-metric zfs-tfoot-metric ${aggCapClass}">${aggCapDisp}</td>
      <td class="zfs-td-metric zfs-tfoot-metric">${escapeHtml(formatBytes(sumAlloc))}</td>
      <td class="zfs-td-metric zfs-tfoot-metric">${escapeHtml(formatBytes(sumFree))}</td>
      <td class="zfs-td-metric zfs-tfoot-metric">${escapeHtml(formatBytes(sumSize))}</td>
      <td class="zfs-td-metric zfs-tfoot-metric">—</td>
      <td class="zfs-td-scan zfs-tfoot-metric">—</td>
      <td class="zfs-td-scan zfs-tfoot-metric">—</td>
    </tr></tfoot>`;
  const rows = pools
    .map((p) => {
      const cap =
        p.capacity_percent != null && Number.isFinite(Number(p.capacity_percent))
          ? `${Number(p.capacity_percent).toFixed(1)}%`
          : "—";
      const frag =
        p.fragmentation_percent != null && Number.isFinite(Number(p.fragmentation_percent))
          ? `${Number(p.fragmentation_percent).toFixed(1)}%`
          : "—";
      const scan = p.scan ? escapeHtml(p.scan) : "—";
      const err = p.errors ? escapeHtml(p.errors) : "—";
      const state = p.state ? escapeHtml(p.state) : "—";
      const hcls = zfsPoolHealthClass(p.health);
      const health = p.health ? escapeHtml(String(p.health)) : "—";
      const scanTitle = p.scan ? escapeHtml(p.scan) : "";
      const errTitle = p.errors ? escapeHtml(p.errors) : "";
      const poolEnc = encodeURIComponent(p.name || "");
      return `<tr class="zfs-row-detail" role="button" tabindex="0" data-pool="${poolEnc}" title="Pool details" aria-label="Open details for pool ${escapeHtml(p.name)}"><td class="zfs-td-name">${escapeHtml(
        p.name || "—"
      )}</td>
      <td class="zfs-td-str">${state}</td>
      <td class="zfs-td-health ${hcls}">${health}</td>
      <td class="zfs-td-metric">${cap}</td>
      <td class="zfs-td-metric">${escapeHtml(formatBytes(p.allocated))}</td>
      <td class="zfs-td-metric">${escapeHtml(formatBytes(p.free))}</td>
      <td class="zfs-td-metric">${escapeHtml(formatBytes(p.size))}</td>
      <td class="zfs-td-metric">${frag}</td>
      <td class="zfs-td-scan" title="${scanTitle}">${scan}</td>
      <td class="zfs-td-scan" title="${errTitle}">${err}</td>
    </tr>`;
    })
    .join("");
  host.innerHTML = `<table class="mc-table mc-table-zfs" aria-label="ZFS pools"><thead><tr>
    <th scope="col">Pool</th>
    <th scope="col">State</th>
    <th scope="col">Health</th>
    <th scope="col" class="zfs-th-num">CAP</th>
    <th scope="col" class="zfs-th-num">Alloc</th>
    <th scope="col" class="zfs-th-num">Free</th>
    <th scope="col" class="zfs-th-num">Size</th>
    <th scope="col" class="zfs-th-num">Frag</th>
    <th scope="col">Scan</th>
    <th scope="col">Errors</th>
  </tr></thead><tbody>${rows}</tbody>${foot}</table>`;
  applySubsectionCollapsed(
    STORAGE_ZFS_COLLAPSED_KEY,
    "zfs-pools-block",
    "storage-zfs-body",
    "Expand ZFS pools",
    "Collapse ZFS pools"
  );
}

function renderDisks(disks) {
  lastDisks = Array.isArray(disks) ? disks : [];
  const wrap = document.getElementById("disk-table");
  if (!wrap) return;
  if (!lastDisks.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No mounts</p>";
    return;
  }
  const list = [...lastDisks].sort(cmpDiskRows);
  let sumUsed = 0;
  let sumFree = 0;
  let sumTotal = 0;
  for (const d of list) {
    const u = Number(d.used);
    const f = Number(d.free);
    const t = Number(d.total);
    if (Number.isFinite(u)) sumUsed += u;
    if (Number.isFinite(f)) sumFree += f;
    if (Number.isFinite(t)) sumTotal += t;
  }
  const aggPct = sumTotal > 0 ? (100 * sumUsed) / sumTotal : NaN;
  const aggPctDisp = Number.isFinite(aggPct) ? `${aggPct.toFixed(1)}%` : "—";
  const aggPctClass = Number.isFinite(aggPct) ? diskClass(aggPct) : "";
  const foot = `<tfoot><tr class="disk-tfoot-row">
      <td class="disk-td-path disk-tfoot-label" colspan="3">Total · ${list.length} mounts</td>
      <td class="disk-td-metric disk-tfoot-metric ${aggPctClass}">${aggPctDisp}</td>
      <td class="disk-td-metric disk-tfoot-metric">${escapeHtml(formatBytes(sumUsed))}</td>
      <td class="disk-td-metric disk-tfoot-metric">${escapeHtml(formatBytes(sumFree))}</td>
      <td class="disk-td-metric disk-tfoot-metric">${escapeHtml(formatBytes(sumTotal))}</td>
      <td class="disk-td-metric disk-td-inode disk-tfoot-metric">—</td>
    </tr></tfoot>`;
  const rows = list
    .map((d) => {
      const pctRaw = Number(d.percent);
      const pct = Number.isFinite(pctRaw) ? pctRaw : 0;
      const enc = encodeURIComponent(d.mountpoint || "");
      const inodeStr =
        d.inode_percent != null ? `${Number(d.inode_percent).toFixed(1)}%` : "—";
      return `<tr class="disk-row-detail" role="button" tabindex="0" data-mp="${enc}" title="Mount details" aria-label="Open details for mount ${escapeHtml(d.mountpoint)}"><td class="disk-td-path">${escapeHtml(
        d.mountpoint
      )}</td><td class="disk-td-str" title="${escapeHtml(d.device || "")}">${escapeHtml(
        d.device || "—"
      )}</td><td class="disk-td-str">${escapeHtml(
        d.fstype || ""
      )}</td><td class="disk-td-metric ${diskClass(pct)}">${pct.toFixed(
        1
      )}%</td><td class="disk-td-metric">${formatBytes(
        d.used
      )}</td><td class="disk-td-metric">${formatBytes(
        d.free
      )}</td><td class="disk-td-metric">${formatBytes(
        d.total
      )}</td><td class="disk-td-metric disk-td-inode">${inodeStr}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table mc-table-disk" aria-label="Storage mounts"><thead><tr>
      <th class="disk-th disk-sortable" scope="col" data-sort-key="mountpoint" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("mountpoint")}">Mount${diskSortArrowHtml("mountpoint")}</th>
      <th class="disk-th disk-sortable" scope="col" data-sort-key="device" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("device")}">Device${diskSortArrowHtml("device")}</th>
      <th class="disk-th disk-sortable" scope="col" data-sort-key="fstype" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("fstype")}">FS${diskSortArrowHtml("fstype")}</th>
      <th class="disk-th disk-sortable disk-th-metric" scope="col" data-sort-key="percent" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("percent")}">Use${diskSortArrowHtml("percent")}</th>
      <th class="disk-th disk-sortable disk-th-metric" scope="col" data-sort-key="used" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("used")}">Used${diskSortArrowHtml("used")}</th>
      <th class="disk-th disk-sortable disk-th-metric" scope="col" data-sort-key="free" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("free")}">Free${diskSortArrowHtml("free")}</th>
      <th class="disk-th disk-sortable disk-th-metric" scope="col" data-sort-key="total" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("total")}">Total${diskSortArrowHtml("total")}</th>
      <th class="disk-th disk-sortable disk-th-metric" scope="col" data-sort-key="inode_percent" role="columnheader" tabindex="0" aria-sort="${diskSortAriaSort("inode_percent")}">Inodes${diskSortArrowHtml("inode_percent")}</th>
    </tr></thead><tbody>${rows}</tbody>${foot}</table>`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

const NET_SORT_KEYDIR_KEY = "mc-net-sort-keydir";
const LISTEN_PORTS_SORT_KEYDIR_KEY = "mc-listen-ports-sort-keydir";

/** @type {"iface"|"ip"|"down"|"up"|"rx"|"tx"} */
let netSortColumn = "iface";
/** @type {"asc"|"desc"} */
let netSortDir = "asc";

/** @type {"proto"|"family"|"lip"|"port"|"pid"|"process"|"fd"} */
let listenPortsSortColumn = "port";
/** @type {"asc"|"desc"} */
let listenPortsSortDir = "asc";

function normalizeNetSortColumn(k) {
  if (k === "down" || k === "up" || k === "iface" || k === "ip" || k === "rx" || k === "tx") return k;
  return "iface";
}

function loadNetSortKeyDir() {
  try {
    const raw = localStorage.getItem(NET_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        netSortColumn = normalizeNetSortColumn(o.column || o.key);
        netSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveNetSortKeyDir() {
  try {
    localStorage.setItem(
      NET_SORT_KEYDIR_KEY,
      JSON.stringify({ column: netSortColumn, dir: netSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function defaultDirForNetColumn(col) {
  if (col === "iface" || col === "ip") return "asc";
  return "desc";
}

function onNetColumnHeaderClick(key) {
  const c = normalizeNetSortColumn(key);
  if (netSortColumn === c) {
    netSortDir = netSortDir === "asc" ? "desc" : "asc";
  } else {
    netSortColumn = c;
    netSortDir = defaultDirForNetColumn(c);
  }
  saveNetSortKeyDir();
  renderNet(lastNetwork);
}

function netSortAriaSort(col) {
  if (netSortColumn !== col) return "none";
  return netSortDir === "asc" ? "ascending" : "descending";
}

function netSortArrowHtml(col) {
  if (netSortColumn !== col) return "";
  const ch = netSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function cmpNetRows(a, b) {
  const dir = netSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (netSortColumn) {
    case "iface":
      cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
      break;
    case "ip":
      cmp = String(a.ip || "").localeCompare(String(b.ip || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "down":
      cmp = (a.recv_bps || 0) - (b.recv_bps || 0);
      break;
    case "up":
      cmp = (a.sent_bps || 0) - (b.sent_bps || 0);
      break;
    case "rx":
      cmp = (Number(a.bytes_recv) || 0) - (Number(b.bytes_recv) || 0);
      break;
    case "tx":
      cmp = (Number(a.bytes_sent) || 0) - (Number(b.bytes_sent) || 0);
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
}

function normalizeListenPortsSortColumn(k) {
  if (
    k === "proto" ||
    k === "family" ||
    k === "lip" ||
    k === "port" ||
    k === "pid" ||
    k === "process" ||
    k === "fd"
  ) {
    return k;
  }
  return "port";
}

function loadListenPortsSortKeyDir() {
  try {
    const raw = localStorage.getItem(LISTEN_PORTS_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        listenPortsSortColumn = normalizeListenPortsSortColumn(o.column || o.key);
        listenPortsSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveListenPortsSortKeyDir() {
  try {
    localStorage.setItem(
      LISTEN_PORTS_SORT_KEYDIR_KEY,
      JSON.stringify({ column: listenPortsSortColumn, dir: listenPortsSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function defaultDirForListenPortsColumn(col) {
  if (col === "port" || col === "pid" || col === "fd") return "asc";
  return "asc";
}

function onListenPortsColumnHeaderClick(key) {
  const c = normalizeListenPortsSortColumn(key);
  if (listenPortsSortColumn === c) {
    listenPortsSortDir = listenPortsSortDir === "asc" ? "desc" : "asc";
  } else {
    listenPortsSortColumn = c;
    listenPortsSortDir = defaultDirForListenPortsColumn(c);
  }
  saveListenPortsSortKeyDir();
  renderListenPortsTableContent();
}

function listenPortsSortAriaSort(col) {
  if (listenPortsSortColumn !== col) return "none";
  return listenPortsSortDir === "asc" ? "ascending" : "descending";
}

function listenPortsSortArrowHtml(col) {
  if (listenPortsSortColumn !== col) return "";
  const ch = listenPortsSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function cmpListenPortsRows(a, b) {
  const dir = listenPortsSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (listenPortsSortColumn) {
    case "proto":
      cmp = String(a.proto || "").localeCompare(String(b.proto || ""), undefined, {
        sensitivity: "base",
      });
      break;
    case "family":
      cmp = String(a.family || "").localeCompare(String(b.family || ""), undefined, {
        sensitivity: "base",
      });
      break;
    case "lip":
      cmp = String(a.local_ip || "").localeCompare(String(b.local_ip || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "port":
      cmp = (Number(a.local_port) || 0) - (Number(b.local_port) || 0);
      break;
    case "pid": {
      const ap = a.pid;
      const bp = b.pid;
      const an = ap != null && Number.isFinite(Number(ap)) ? Number(ap) : NaN;
      const bn = bp != null && Number.isFinite(Number(bp)) ? Number(bp) : NaN;
      if (!Number.isFinite(an) && !Number.isFinite(bn)) cmp = 0;
      else if (!Number.isFinite(an)) cmp = 1;
      else if (!Number.isFinite(bn)) cmp = -1;
      else cmp = an - bn;
      break;
    }
    case "process":
      cmp = String(a.process || "").localeCompare(String(b.process || ""), undefined, {
        sensitivity: "base",
      });
      break;
    case "fd": {
      const af = a.fd;
      const bf = b.fd;
      const an = af != null && Number.isFinite(Number(af)) ? Number(af) : NaN;
      const bn = bf != null && Number.isFinite(Number(bf)) ? Number(bf) : NaN;
      if (!Number.isFinite(an) && !Number.isFinite(bn)) cmp = 0;
      else if (!Number.isFinite(an)) cmp = 1;
      else if (!Number.isFinite(bn)) cmp = -1;
      else cmp = an - bn;
      break;
    }
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return (Number(a.local_port) || 0) - (Number(b.local_port) || 0);
}

function initNetSortHeaderClicks() {
  const host = document.getElementById("panel-body-network");
  if (!host || host.dataset.netSortBound === "1") return;
  host.dataset.netSortBound = "1";
  host.addEventListener("click", (e) => {
    const thPorts = e.target.closest("th.net-ports-sortable[data-sort-key]");
    if (thPorts && host.contains(thPorts)) {
      onListenPortsColumnHeaderClick(thPorts.getAttribute("data-sort-key") || "");
      return;
    }
    const th = e.target.closest("th.net-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    onNetColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const thPorts = e.target.closest("th.net-ports-sortable[data-sort-key]");
    if (thPorts && host.contains(thPorts)) {
      e.preventDefault();
      onListenPortsColumnHeaderClick(thPorts.getAttribute("data-sort-key") || "");
      return;
    }
    const th = e.target.closest("th.net-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    e.preventDefault();
    onNetColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
}

function initNetRateUnitControl() {
  netRateUnit = loadNetRateUnit();
  const sel = document.getElementById("net-rate-unit-select");
  if (!sel) return;
  sel.value = netRateUnit;
  sel.addEventListener("change", () => {
    netRateUnit = normalizeNetRateUnitSelect(sel.value);
    try {
      localStorage.setItem(NET_RATE_UNIT_KEY, netRateUnit);
    } catch (_) {
      /* ignore */
    }
    renderNet(lastNetwork);
  });
}

function initNetworkPanel() {
  loadNetSortKeyDir();
  loadListenPortsSortKeyDir();
  initNetSortHeaderClicks();
  initNetRateUnitControl();
  initNetInterfaceRowClicks();
  applySubsectionCollapsed(
    NETWORK_INTERFACES_COLLAPSED_KEY,
    "net-interfaces-subsection",
    "net-interfaces-body",
    "Expand Interfaces",
    "Collapse Interfaces"
  );
  initSubsectionCollapse(
    NETWORK_INTERFACES_COLLAPSED_KEY,
    "net-interfaces-subsection",
    "net-interfaces-body",
    "Expand Interfaces",
    "Collapse Interfaces",
    "netIfSubCollapseBound",
    connectMetricsStream
  );
  applySubsectionCollapsed(
    NETWORK_LISTEN_PORTS_COLLAPSED_KEY,
    "net-listen-ports-subsection",
    "net-listen-ports-body",
    "Expand Listening ports",
    "Collapse Listening ports"
  );
  initSubsectionCollapse(
    NETWORK_LISTEN_PORTS_COLLAPSED_KEY,
    "net-listen-ports-subsection",
    "net-listen-ports-body",
    "Expand Listening ports",
    "Collapse Listening ports",
    "netListenPortsSubBound",
    connectMetricsStream
  );
  initListenPortsToolbar();
}

function renderNet(net) {
  const wrap = document.getElementById("net-table");
  if (!wrap) return;
  if (!net || !net.interfaces || !Object.keys(net.interfaces).length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No interfaces</p>";
    return;
  }
  const rates = net.rates || {};
  const list = Object.keys(net.interfaces).map((name) => {
    const iface = net.interfaces[name] || {};
    return {
      name,
      ip: String(iface.ip || "").trim(),
      bytes_recv: Number(iface.bytes_recv),
      bytes_sent: Number(iface.bytes_sent),
      recv_bps: Number(rates[name] && rates[name].recv_bps) || 0,
      sent_bps: Number(rates[name] && rates[name].sent_bps) || 0,
    };
  });
  list.sort(cmpNetRows);
  const rows = list
    .map((row) => {
      const enc = encodeURIComponent(row.name);
      const ipDisp = row.ip || "—";
      const rxDisp = Number.isFinite(row.bytes_recv) ? formatBytes(row.bytes_recv) : "—";
      const txDisp = Number.isFinite(row.bytes_sent) ? formatBytes(row.bytes_sent) : "—";
      return `<tr class="net-row-detail" role="button" tabindex="0" data-ifname="${enc}" title="Interface details" aria-label="Open details for interface ${escapeHtml(row.name)}"><td class="net-td-iface">${escapeHtml(row.name)}</td><td class="net-td-ip" title="${escapeHtml(row.ip || "")}">${escapeHtml(ipDisp)}</td><td class="net-td-metric">${escapeHtml(
        formatNetRate(row.recv_bps)
      )}</td><td class="net-td-metric">${escapeHtml(formatNetRate(row.sent_bps))}</td><td class="net-td-metric net-td-bytes" title="Bytes received (cumulative)">${escapeHtml(rxDisp)}</td><td class="net-td-metric net-td-bytes" title="Bytes sent (cumulative)">${escapeHtml(txDisp)}</td></tr>`;
    })
    .join("");
  const rateExtraClass = netRateUnit === "both" ? " mc-table-net-rate-both" : "";
  wrap.innerHTML = `<table class="mc-table mc-table-net${rateExtraClass}" aria-label="Network interfaces"><thead><tr>
      <th class="net-th net-sortable" scope="col" data-sort-key="iface" role="columnheader" tabindex="0" aria-sort="${netSortAriaSort("iface")}">Interface${netSortArrowHtml("iface")}</th>
      <th class="net-th net-sortable net-th-ip" scope="col" data-sort-key="ip" role="columnheader" tabindex="0" aria-sort="${netSortAriaSort("ip")}">IP address${netSortArrowHtml("ip")}</th>
      <th class="net-th net-sortable net-th-metric" scope="col" data-sort-key="down" role="columnheader" tabindex="0" aria-sort="${netSortAriaSort("down")}">Down${netSortArrowHtml("down")}</th>
      <th class="net-th net-sortable net-th-metric" scope="col" data-sort-key="up" role="columnheader" tabindex="0" aria-sort="${netSortAriaSort("up")}">Up${netSortArrowHtml("up")}</th>
      <th class="net-th net-sortable net-th-metric" scope="col" data-sort-key="rx" role="columnheader" tabindex="0" aria-sort="${netSortAriaSort("rx")}" title="Bytes received (cumulative since boot)">RX${netSortArrowHtml("rx")}</th>
      <th class="net-th net-sortable net-th-metric" scope="col" data-sort-key="tx" role="columnheader" tabindex="0" aria-sort="${netSortAriaSort("tx")}" title="Bytes sent (cumulative since boot)">TX${netSortArrowHtml("tx")}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

let listenPortsSearchDebounceTimer = null;

function normalizeListenPortsProtoFilter(v) {
  const s = String(v || "").toLowerCase();
  if (s === "tcp" || s === "udp") return s;
  return "all";
}

function normalizeListenPortsFamilyFilter(v) {
  const s = String(v || "").toLowerCase();
  if (s === "ipv4" || s === "ipv6" || s === "other") return s;
  return "all";
}

function loadListenPortsToolbarIntoDom() {
  const searchEl = document.getElementById("net-listen-ports-search");
  const protoEl = document.getElementById("net-listen-ports-proto");
  const famEl = document.getElementById("net-listen-ports-family");
  if (!searchEl || !protoEl || !famEl) return;
  let s = "";
  let p = "all";
  let f = "all";
  try {
    s = localStorage.getItem(LISTEN_PORTS_SEARCH_KEY) || "";
  } catch (_) {
    /* ignore */
  }
  try {
    p = normalizeListenPortsProtoFilter(localStorage.getItem(LISTEN_PORTS_PROTO_FILTER_KEY));
  } catch (_) {
    /* ignore */
  }
  try {
    f = normalizeListenPortsFamilyFilter(localStorage.getItem(LISTEN_PORTS_FAMILY_FILTER_KEY));
  } catch (_) {
    /* ignore */
  }
  searchEl.value = s;
  protoEl.value = p === "tcp" || p === "udp" ? p : "all";
  famEl.value = ["ipv4", "ipv6", "other"].includes(f) ? f : "all";
}

function getListenPortsFiltersFromDom() {
  const searchEl = document.getElementById("net-listen-ports-search");
  const protoEl = document.getElementById("net-listen-ports-proto");
  const famEl = document.getElementById("net-listen-ports-family");
  return {
    search: searchEl ? searchEl.value : "",
    proto: normalizeListenPortsProtoFilter(protoEl && protoEl.value),
    family: normalizeListenPortsFamilyFilter(famEl && famEl.value),
  };
}

function listenPortsSearchTermsFromQuery(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function listenPortsRowMatchesSearch(row, terms) {
  if (!terms.length) return true;
  const hay = [
    row.local_ip || "",
    String(
      row.local_port != null && Number.isFinite(Number(row.local_port)) ? row.local_port : ""
    ),
    row.process || "",
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((t) => hay.includes(t));
}

function filterListenPortsNormalizedList(list, filters) {
  let out = list;
  if (filters.proto !== "all") {
    out = out.filter((r) => r.proto === filters.proto);
  }
  if (filters.family !== "all") {
    out = out.filter((r) => r.family === filters.family);
  }
  const terms = listenPortsSearchTermsFromQuery(filters.search);
  if (terms.length) {
    out = out.filter((r) => listenPortsRowMatchesSearch(r, terms));
  }
  return out;
}

function normalizeListenPortsRows(data) {
  const rowsArr = data && Array.isArray(data.rows) ? data.rows : [];
  return rowsArr.map((r) => ({
    proto: String(r.proto || "").toLowerCase(),
    family: String(r.family || ""),
    local_ip: String(r.local_ip != null ? r.local_ip : ""),
    local_port: Number(r.local_port),
    pid: r.pid != null && Number.isFinite(Number(r.pid)) ? Number(r.pid) : null,
    process: r.process != null ? String(r.process) : null,
    fd: r.fd != null && Number.isFinite(Number(r.fd)) ? Number(r.fd) : null,
  }));
}

function renderListenPortsTableContent() {
  const wrap = document.getElementById("net-listen-ports-table");
  if (!wrap) return;
  const data = lastListeningPorts;
  let noteHtml = "";
  if (data && data.note) {
    noteHtml = `<p class="tile-meta mc-listen-ports-note">${escapeHtml(data.note)}</p>`;
  }
  const list = normalizeListenPortsRows(data);
  const filters = getListenPortsFiltersFromDom();
  const filtered = filterListenPortsNormalizedList(list, filters);
  filtered.sort(cmpListenPortsRows);

  if (!list.length) {
    const emptyMsg = noteHtml
      ? noteHtml
      : "<p class=\"tile-meta\">No listening TCP or bound UDP sockets reported.</p>";
    wrap.innerHTML = emptyMsg;
    return;
  }

  if (!filtered.length) {
    wrap.innerHTML = `${noteHtml}<p class="tile-meta">No rows match the current search or filters.</p>`;
    return;
  }

  const body = filtered
    .map((row) => {
      const lip = row.local_ip || "—";
      const portDisp =
        Number.isFinite(row.local_port) && row.local_port > 0 ? String(row.local_port) : "—";
      const pidDisp = row.pid != null ? String(row.pid) : "—";
      const procDisp = row.process != null && row.process !== "" ? row.process : "—";
      const fdDisp = row.fd != null ? String(row.fd) : "—";
      return `<tr><td class="net-port-td">${escapeHtml(row.proto)}</td><td class="net-port-td">${escapeHtml(
        row.family
      )}</td><td class="net-port-td-ip" title="${escapeHtml(lip)}">${escapeHtml(
        lip
      )}</td><td class="net-port-td-num">${escapeHtml(portDisp)}</td><td class="net-port-td-num">${escapeHtml(
        pidDisp
      )}</td><td class="net-port-td-proc" title="${escapeHtml(procDisp)}">${escapeHtml(
        procDisp
      )}</td><td class="net-port-td-num" title="File descriptor">${escapeHtml(fdDisp)}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `${noteHtml}<table class="mc-table mc-table-net-ports" aria-label="Listening ports"><thead><tr>
      <th class="net-port-th net-ports-sortable" scope="col" data-sort-key="proto" role="columnheader" tabindex="0" aria-sort="${listenPortsSortAriaSort("proto")}">Proto${listenPortsSortArrowHtml("proto")}</th>
      <th class="net-port-th net-ports-sortable" scope="col" data-sort-key="family" role="columnheader" tabindex="0" aria-sort="${listenPortsSortAriaSort("family")}">Family${listenPortsSortArrowHtml("family")}</th>
      <th class="net-port-th net-ports-sortable net-port-th-ip" scope="col" data-sort-key="lip" role="columnheader" tabindex="0" aria-sort="${listenPortsSortAriaSort("lip")}">Local IP${listenPortsSortArrowHtml("lip")}</th>
      <th class="net-port-th net-ports-sortable net-port-th-num" scope="col" data-sort-key="port" role="columnheader" tabindex="0" aria-sort="${listenPortsSortAriaSort("port")}">Port${listenPortsSortArrowHtml("port")}</th>
      <th class="net-port-th net-ports-sortable net-port-th-num" scope="col" data-sort-key="pid" role="columnheader" tabindex="0" aria-sort="${listenPortsSortAriaSort("pid")}">PID${listenPortsSortArrowHtml("pid")}</th>
      <th class="net-port-th net-ports-sortable net-port-th-proc" scope="col" data-sort-key="process" role="columnheader" tabindex="0" aria-sort="${listenPortsSortAriaSort("process")}">Process${listenPortsSortArrowHtml("process")}</th>
      <th class="net-port-th net-ports-sortable net-port-th-num" scope="col" data-sort-key="fd" role="columnheader" tabindex="0" title="File descriptor" aria-sort="${listenPortsSortAriaSort("fd")}">FD${listenPortsSortArrowHtml("fd")}</th>
    </tr></thead><tbody>${body}</tbody></table>`;
}

function renderListeningPorts(data) {
  lastListeningPorts = data ?? null;
  renderListenPortsTableContent();
}

function initListenPortsToolbar() {
  const tb = document.getElementById("net-listen-ports-toolbar");
  if (!tb || tb.dataset.listenPortsToolbarBound === "1") return;
  tb.dataset.listenPortsToolbarBound = "1";
  loadListenPortsToolbarIntoDom();
  const searchEl = document.getElementById("net-listen-ports-search");
  const protoEl = document.getElementById("net-listen-ports-proto");
  const famEl = document.getElementById("net-listen-ports-family");
  searchEl?.addEventListener("input", () => {
    clearTimeout(listenPortsSearchDebounceTimer);
    listenPortsSearchDebounceTimer = setTimeout(() => {
      try {
        localStorage.setItem(LISTEN_PORTS_SEARCH_KEY, searchEl.value);
      } catch (_) {
        /* ignore */
      }
      renderListenPortsTableContent();
    }, 200);
  });
  protoEl?.addEventListener("change", () => {
    try {
      localStorage.setItem(
        LISTEN_PORTS_PROTO_FILTER_KEY,
        normalizeListenPortsProtoFilter(protoEl.value)
      );
    } catch (_) {
      /* ignore */
    }
    renderListenPortsTableContent();
  });
  famEl?.addEventListener("change", () => {
    try {
      localStorage.setItem(
        LISTEN_PORTS_FAMILY_FILTER_KEY,
        normalizeListenPortsFamilyFilter(famEl.value)
      );
    } catch (_) {
      /* ignore */
    }
    renderListenPortsTableContent();
  });
}

/** @type {"name"|"state"|"image"|"status"|"ports"|"id_short"|"running_for"} */
let dockerContSortColumn = "name";
/** @type {"asc"|"desc"} */
let dockerContSortDir = "asc";

/** @type {"repository"|"tag"|"id_short"|"size"|"created"} */
let dockerImgSortColumn = "repository";
/** @type {"asc"|"desc"} */
let dockerImgSortDir = "asc";

/** @type {"name"|"driver"} */
let dockerVolSortColumn = "name";
/** @type {"asc"|"desc"} */
let dockerVolSortDir = "asc";

function normalizeDockerContSortColumn(k) {
  if (
    k === "name" ||
    k === "state" ||
    k === "image" ||
    k === "status" ||
    k === "ports" ||
    k === "id_short" ||
    k === "running_for"
  ) {
    return k;
  }
  return "name";
}

function loadDockerContSortKeyDir() {
  try {
    const raw = localStorage.getItem(DOCKER_CONT_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        dockerContSortColumn = normalizeDockerContSortColumn(o.column || o.key);
        dockerContSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveDockerContSortKeyDir() {
  try {
    localStorage.setItem(
      DOCKER_CONT_SORT_KEYDIR_KEY,
      JSON.stringify({ column: dockerContSortColumn, dir: dockerContSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function dockerContSortAriaSort(col) {
  if (dockerContSortColumn !== col) return "none";
  return dockerContSortDir === "asc" ? "ascending" : "descending";
}

function dockerContSortArrowHtml(col) {
  if (dockerContSortColumn !== col) return "";
  const ch = dockerContSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function onDockerContSortClick(key) {
  const c = normalizeDockerContSortColumn(key);
  if (dockerContSortColumn === c) {
    dockerContSortDir = dockerContSortDir === "asc" ? "desc" : "asc";
  } else {
    dockerContSortColumn = c;
    dockerContSortDir = "asc";
  }
  saveDockerContSortKeyDir();
  renderDockerContainers();
}

function cmpDockerContRows(a, b) {
  const dir = dockerContSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (dockerContSortColumn) {
    case "name":
      cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      break;
    case "state":
      cmp = String(a.state || "").localeCompare(String(b.state || ""), undefined, { sensitivity: "base" });
      break;
    case "image":
      cmp = String(a.image || "").localeCompare(String(b.image || ""), undefined, { sensitivity: "base" });
      break;
    case "status":
      cmp = String(a.status || "").localeCompare(String(b.status || ""), undefined, { sensitivity: "base" });
      break;
    case "ports":
      cmp = String(a.ports || "").localeCompare(String(b.ports || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "id_short":
      cmp = String(a.id_short || "").localeCompare(String(b.id_short || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "running_for":
      cmp = String(a.running_for || "").localeCompare(String(b.running_for || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
}

function normalizeDockerImgSortColumn(k) {
  if (k === "repository" || k === "tag" || k === "id_short" || k === "size" || k === "created") return k;
  return "repository";
}

function loadDockerImgSortKeyDir() {
  try {
    const raw = localStorage.getItem(DOCKER_IMG_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        dockerImgSortColumn = normalizeDockerImgSortColumn(o.column || o.key);
        dockerImgSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveDockerImgSortKeyDir() {
  try {
    localStorage.setItem(
      DOCKER_IMG_SORT_KEYDIR_KEY,
      JSON.stringify({ column: dockerImgSortColumn, dir: dockerImgSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function dockerImgSortAriaSort(col) {
  if (dockerImgSortColumn !== col) return "none";
  return dockerImgSortDir === "asc" ? "ascending" : "descending";
}

function dockerImgSortArrowHtml(col) {
  if (dockerImgSortColumn !== col) return "";
  const ch = dockerImgSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function onDockerImgSortClick(key) {
  const c = normalizeDockerImgSortColumn(key);
  if (dockerImgSortColumn === c) {
    dockerImgSortDir = dockerImgSortDir === "asc" ? "desc" : "asc";
  } else {
    dockerImgSortColumn = c;
    dockerImgSortDir = "asc";
  }
  saveDockerImgSortKeyDir();
  renderDockerImages();
}

function cmpDockerImgRows(a, b) {
  const dir = dockerImgSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (dockerImgSortColumn) {
    case "repository":
      cmp = String(a.repository || "").localeCompare(String(b.repository || ""), undefined, {
        sensitivity: "base",
      });
      break;
    case "tag":
      cmp = String(a.tag || "").localeCompare(String(b.tag || ""), undefined, { sensitivity: "base" });
      break;
    case "id_short":
      cmp = String(a.id_short || "").localeCompare(String(b.id_short || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "size":
      cmp = String(a.size || "").localeCompare(String(b.size || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "created":
      cmp = String(a.created || "").localeCompare(String(b.created || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.repository || "").localeCompare(String(b.repository || ""), undefined, { sensitivity: "base" });
}

function normalizeDockerVolSortColumn(k) {
  if (k === "name" || k === "driver") return k;
  return "name";
}

function loadDockerVolSortKeyDir() {
  try {
    const raw = localStorage.getItem(DOCKER_VOL_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        dockerVolSortColumn = normalizeDockerVolSortColumn(o.column || o.key);
        dockerVolSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveDockerVolSortKeyDir() {
  try {
    localStorage.setItem(
      DOCKER_VOL_SORT_KEYDIR_KEY,
      JSON.stringify({ column: dockerVolSortColumn, dir: dockerVolSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function dockerVolSortAriaSort(col) {
  if (dockerVolSortColumn !== col) return "none";
  return dockerVolSortDir === "asc" ? "ascending" : "descending";
}

function dockerVolSortArrowHtml(col) {
  if (dockerVolSortColumn !== col) return "";
  const ch = dockerVolSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function onDockerVolSortClick(key) {
  const c = normalizeDockerVolSortColumn(key);
  if (dockerVolSortColumn === c) {
    dockerVolSortDir = dockerVolSortDir === "asc" ? "desc" : "asc";
  } else {
    dockerVolSortColumn = c;
    dockerVolSortDir = "asc";
  }
  saveDockerVolSortKeyDir();
  renderDockerVolumes();
}

function cmpDockerVolRows(a, b) {
  const dir = dockerVolSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (dockerVolSortColumn) {
    case "name":
      cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      break;
    case "driver":
      cmp = String(a.driver || "").localeCompare(String(b.driver || ""), undefined, { sensitivity: "base" });
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
}

function renderDockerDetailHtml(obj) {
  if (!obj) return "<p class=\"tile-meta\">No data.</p>";
  return (
    '<details class="proc-detail-raw" open><summary>Docker inspect (JSON)</summary>' +
    `<pre class="proc-detail-json">${escapeHtml(JSON.stringify(obj, null, 2))}</pre></details>`
  );
}

function renderDockerContainers() {
  const wrap = document.getElementById("docker-containers-table");
  if (!wrap) return;
  const data = lastDocker;
  const rows = data && Array.isArray(data.containers) ? data.containers : [];
  if (!rows.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No containers (or Docker unavailable).</p>";
    return;
  }
  const list = rows.map((r) => ({ ...r }));
  list.sort(cmpDockerContRows);
  const body = list
    .map((row) => {
      const encId = encodeURIComponent(row.id || "");
      const nm = row.name || "—";
      return `<tr class="dock-cont-row" role="button" tabindex="0" data-docker-id="${encId}" title="Container details" aria-label="Open details for container ${escapeHtml(nm)}"><td class="dock-td-name">${escapeHtml(nm)}</td><td class="dock-td">${escapeHtml(row.state || "—")}</td><td class="dock-td-img">${escapeHtml(row.image || "—")}</td><td class="dock-td-status">${escapeHtml(row.status || "—")}</td><td class="dock-td-ports" title="${escapeHtml(row.ports || "")}">${escapeHtml(row.ports || "—")}</td><td class="dock-td-mono">${escapeHtml(row.id_short || "—")}</td><td class="dock-td">${escapeHtml(row.running_for || "—")}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table mc-table-dock" aria-label="Docker containers"><thead><tr>
      <th class="dock-th dock-cont-sortable" scope="col" data-sort-key="name" role="columnheader" tabindex="0" aria-sort="${dockerContSortAriaSort("name")}">Name${dockerContSortArrowHtml("name")}</th>
      <th class="dock-th dock-cont-sortable" scope="col" data-sort-key="state" role="columnheader" tabindex="0" aria-sort="${dockerContSortAriaSort("state")}">State${dockerContSortArrowHtml("state")}</th>
      <th class="dock-th dock-cont-sortable dock-th-img" scope="col" data-sort-key="image" role="columnheader" tabindex="0" aria-sort="${dockerContSortAriaSort("image")}">Image${dockerContSortArrowHtml("image")}</th>
      <th class="dock-th dock-cont-sortable" scope="col" data-sort-key="status" role="columnheader" tabindex="0" aria-sort="${dockerContSortAriaSort("status")}">Status${dockerContSortArrowHtml("status")}</th>
      <th class="dock-th dock-cont-sortable dock-th-ports" scope="col" data-sort-key="ports" role="columnheader" tabindex="0" aria-sort="${dockerContSortAriaSort("ports")}">Ports${dockerContSortArrowHtml("ports")}</th>
      <th class="dock-th dock-cont-sortable dock-td-mono" scope="col" data-sort-key="id_short" role="columnheader" tabindex="0" aria-sort="${dockerContSortAriaSort("id_short")}">ID${dockerContSortArrowHtml("id_short")}</th>
      <th class="dock-th dock-cont-sortable" scope="col" data-sort-key="running_for" role="columnheader" tabindex="0" aria-sort="${dockerContSortAriaSort("running_for")}">Age${dockerContSortArrowHtml("running_for")}</th>
    </tr></thead><tbody>${body}</tbody></table>`;
}

function renderDockerImages() {
  const wrap = document.getElementById("docker-images-table");
  if (!wrap) return;
  const data = lastDocker;
  const rows = data && Array.isArray(data.images) ? data.images : [];
  if (!rows.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No images (or Docker unavailable).</p>";
    return;
  }
  const list = rows.map((r) => ({ ...r }));
  list.sort(cmpDockerImgRows);
  const body = list
    .map((row) => {
      const ref = row.inspect_ref || row.id || "";
      const encRef = encodeURIComponent(ref);
      const lab = `${row.repository || ""}:${row.tag || ""}`;
      return `<tr class="dock-img-row" role="button" tabindex="0" data-docker-iref="${encRef}" title="Image details" aria-label="Open details for image ${escapeHtml(lab)}"><td class="dock-td-img">${escapeHtml(row.repository || "—")}</td><td class="dock-td">${escapeHtml(row.tag || "—")}</td><td class="dock-td-mono">${escapeHtml(row.id_short || "—")}</td><td class="dock-td">${escapeHtml(row.size || "—")}</td><td class="dock-td">${escapeHtml(row.created || "—")}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table mc-table-dock" aria-label="Docker images"><thead><tr>
      <th class="dock-th dock-img-sortable dock-th-img" scope="col" data-sort-key="repository" role="columnheader" tabindex="0" aria-sort="${dockerImgSortAriaSort("repository")}">Repository${dockerImgSortArrowHtml("repository")}</th>
      <th class="dock-th dock-img-sortable" scope="col" data-sort-key="tag" role="columnheader" tabindex="0" aria-sort="${dockerImgSortAriaSort("tag")}">Tag${dockerImgSortArrowHtml("tag")}</th>
      <th class="dock-th dock-img-sortable dock-td-mono" scope="col" data-sort-key="id_short" role="columnheader" tabindex="0" aria-sort="${dockerImgSortAriaSort("id_short")}">ID${dockerImgSortArrowHtml("id_short")}</th>
      <th class="dock-th dock-img-sortable" scope="col" data-sort-key="size" role="columnheader" tabindex="0" aria-sort="${dockerImgSortAriaSort("size")}">Size${dockerImgSortArrowHtml("size")}</th>
      <th class="dock-th dock-img-sortable" scope="col" data-sort-key="created" role="columnheader" tabindex="0" aria-sort="${dockerImgSortAriaSort("created")}">Created${dockerImgSortArrowHtml("created")}</th>
    </tr></thead><tbody>${body}</tbody></table>`;
}

function renderDockerVolumes() {
  const wrap = document.getElementById("docker-volumes-table");
  if (!wrap) return;
  const data = lastDocker;
  const rows = data && Array.isArray(data.volumes) ? data.volumes : [];
  if (!rows.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No volumes (or Docker unavailable).</p>";
    return;
  }
  const list = rows.map((r) => ({ ...r }));
  list.sort(cmpDockerVolRows);
  const body = list
    .map((row) => {
      const enc = encodeURIComponent(row.name || "");
      return `<tr class="dock-vol-row" role="button" tabindex="0" data-docker-vol="${enc}" title="Volume details" aria-label="Open details for volume ${escapeHtml(row.name)}"><td class="dock-td-name">${escapeHtml(row.name || "—")}</td><td class="dock-td">${escapeHtml(row.driver || "—")}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table mc-table-dock" aria-label="Docker volumes"><thead><tr>
      <th class="dock-th dock-vol-sortable" scope="col" data-sort-key="name" role="columnheader" tabindex="0" aria-sort="${dockerVolSortAriaSort("name")}">Name${dockerVolSortArrowHtml("name")}</th>
      <th class="dock-th dock-vol-sortable" scope="col" data-sort-key="driver" role="columnheader" tabindex="0" aria-sort="${dockerVolSortAriaSort("driver")}">Driver${dockerVolSortArrowHtml("driver")}</th>
    </tr></thead><tbody>${body}</tbody></table>`;
}

function renderDockerAll() {
  const noteEl = document.getElementById("docker-panel-note");
  if (noteEl) {
    if (lastDocker && lastDocker.note) {
      noteEl.textContent = lastDocker.note;
      noteEl.hidden = false;
    } else if (lastDocker === null) {
      noteEl.textContent =
        "Docker metrics omitted: hide the Containers panel, collapse it, or collapse all Docker subsections.";
      noteEl.hidden = false;
    } else {
      noteEl.textContent = "";
      noteEl.hidden = true;
    }
  }
  renderDockerContainers();
  renderDockerImages();
  renderDockerVolumes();
}

function closeDockerDetailModal() {
  const backdrop = document.getElementById("docker-detail-backdrop");
  const dialog = document.getElementById("docker-detail-dialog");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
  }
}

function openDockerContainerDetailModal(containerId, displayName) {
  const backdrop = document.getElementById("docker-detail-backdrop");
  const dialog = document.getElementById("docker-detail-dialog");
  const body = document.getElementById("docker-detail-body");
  const title = document.getElementById("docker-detail-title");
  if (!backdrop || !dialog || !body || !title) return;
  title.textContent = displayName || containerId;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");
  document.getElementById("docker-detail-close")?.focus();
  const q = encodeURIComponent(containerId);
  fetch(`/api/docker/container?id=${q}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Container not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = displayName || containerId;
      body.innerHTML = renderDockerDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = displayName || containerId;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function openDockerImageDetailModal(inspectRef, displayName) {
  const backdrop = document.getElementById("docker-detail-backdrop");
  const dialog = document.getElementById("docker-detail-dialog");
  const body = document.getElementById("docker-detail-body");
  const title = document.getElementById("docker-detail-title");
  if (!backdrop || !dialog || !body || !title) return;
  title.textContent = displayName || inspectRef;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");
  document.getElementById("docker-detail-close")?.focus();
  const q = encodeURIComponent(inspectRef);
  fetch(`/api/docker/image?ref=${q}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Image not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = displayName || inspectRef;
      body.innerHTML = renderDockerDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = displayName || inspectRef;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function openDockerVolumeDetailModal(volName, displayName) {
  const backdrop = document.getElementById("docker-detail-backdrop");
  const dialog = document.getElementById("docker-detail-dialog");
  const body = document.getElementById("docker-detail-body");
  const title = document.getElementById("docker-detail-title");
  if (!backdrop || !dialog || !body || !title) return;
  title.textContent = displayName || volName;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");
  document.getElementById("docker-detail-close")?.focus();
  const q = encodeURIComponent(volName);
  fetch(`/api/docker/volume?name=${q}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Volume not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = displayName || volName;
      body.innerHTML = renderDockerDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = displayName || volName;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function initDockerSortHeaderClicks() {
  const host = document.getElementById("panel-body-containers");
  if (!host || host.dataset.dockerSortBound === "1") return;
  host.dataset.dockerSortBound = "1";
  host.addEventListener("click", (e) => {
    const tc = e.target.closest("th.dock-cont-sortable[data-sort-key]");
    if (tc && host.contains(tc)) {
      onDockerContSortClick(tc.getAttribute("data-sort-key") || "");
      return;
    }
    const ti = e.target.closest("th.dock-img-sortable[data-sort-key]");
    if (ti && host.contains(ti)) {
      onDockerImgSortClick(ti.getAttribute("data-sort-key") || "");
      return;
    }
    const tv = e.target.closest("th.dock-vol-sortable[data-sort-key]");
    if (tv && host.contains(tv)) {
      onDockerVolSortClick(tv.getAttribute("data-sort-key") || "");
    }
  });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tc = e.target.closest("th.dock-cont-sortable[data-sort-key]");
    if (tc && host.contains(tc)) {
      e.preventDefault();
      onDockerContSortClick(tc.getAttribute("data-sort-key") || "");
      return;
    }
    const ti = e.target.closest("th.dock-img-sortable[data-sort-key]");
    if (ti && host.contains(ti)) {
      e.preventDefault();
      onDockerImgSortClick(ti.getAttribute("data-sort-key") || "");
      return;
    }
    const tv = e.target.closest("th.dock-vol-sortable[data-sort-key]");
    if (tv && host.contains(tv)) {
      e.preventDefault();
      onDockerVolSortClick(tv.getAttribute("data-sort-key") || "");
    }
  });
}

function initDockerContainersRowClicks() {
  const wrap = document.getElementById("docker-containers-table");
  if (!wrap || wrap.dataset.dockerRowBound === "1") return;
  wrap.dataset.dockerRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.dock-cont-row[data-docker-id]");
    if (!tr || !wrap.contains(tr)) return;
    const id = decodeURIComponent(tr.getAttribute("data-docker-id") || "");
    if (!id) return;
    openDockerContainerDetailModal(id, tr.querySelector(".dock-td-name")?.textContent || "");
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.dock-cont-row[data-docker-id]");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const id = decodeURIComponent(tr.getAttribute("data-docker-id") || "");
    if (!id) return;
    openDockerContainerDetailModal(id, tr.querySelector(".dock-td-name")?.textContent || "");
  });
}

function initDockerImagesRowClicks() {
  const wrap = document.getElementById("docker-images-table");
  if (!wrap || wrap.dataset.dockerRowBound === "1") return;
  wrap.dataset.dockerRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.dock-img-row[data-docker-iref]");
    if (!tr || !wrap.contains(tr)) return;
    const ref = decodeURIComponent(tr.getAttribute("data-docker-iref") || "");
    if (!ref) return;
    const tds = tr.querySelectorAll("td");
    const lab = tds.length >= 2 ? `${tds[0].textContent}:${tds[1].textContent}` : ref;
    openDockerImageDetailModal(ref, lab);
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.dock-img-row[data-docker-iref]");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const ref = decodeURIComponent(tr.getAttribute("data-docker-iref") || "");
    if (!ref) return;
    const tds = tr.querySelectorAll("td");
    const lab = tds.length >= 2 ? `${tds[0].textContent}:${tds[1].textContent}` : ref;
    openDockerImageDetailModal(ref, lab);
  });
}

function initDockerVolumesRowClicks() {
  const wrap = document.getElementById("docker-volumes-table");
  if (!wrap || wrap.dataset.dockerRowBound === "1") return;
  wrap.dataset.dockerRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.dock-vol-row[data-docker-vol]");
    if (!tr || !wrap.contains(tr)) return;
    const name = decodeURIComponent(tr.getAttribute("data-docker-vol") || "");
    if (!name) return;
    openDockerVolumeDetailModal(name, tr.querySelector(".dock-td-name")?.textContent || "");
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.dock-vol-row[data-docker-vol]");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const name = decodeURIComponent(tr.getAttribute("data-docker-vol") || "");
    if (!name) return;
    openDockerVolumeDetailModal(name, tr.querySelector(".dock-td-name")?.textContent || "");
  });
}

function initDockerDetailModal() {
  const backdrop = document.getElementById("docker-detail-backdrop");
  const closeBtn = document.getElementById("docker-detail-close");
  closeBtn?.addEventListener("click", closeDockerDetailModal);
  backdrop?.addEventListener("click", closeDockerDetailModal);
}

function initContainersPanel() {
  loadDockerContSortKeyDir();
  loadDockerImgSortKeyDir();
  loadDockerVolSortKeyDir();
  initDockerSortHeaderClicks();
  initDockerContainersRowClicks();
  initDockerImagesRowClicks();
  initDockerVolumesRowClicks();
  applySubsectionCollapsed(
    DOCKER_CONT_COLLAPSED_KEY,
    "docker-containers-subsection",
    "docker-containers-body",
    "Expand Docker containers",
    "Collapse Docker containers"
  );
  initSubsectionCollapse(
    DOCKER_CONT_COLLAPSED_KEY,
    "docker-containers-subsection",
    "docker-containers-body",
    "Expand Docker containers",
    "Collapse Docker containers",
    "dockerContSubBound",
    connectMetricsStream
  );
  applySubsectionCollapsed(
    DOCKER_IMG_COLLAPSED_KEY,
    "docker-images-subsection",
    "docker-images-body",
    "Expand Docker images",
    "Collapse Docker images"
  );
  initSubsectionCollapse(
    DOCKER_IMG_COLLAPSED_KEY,
    "docker-images-subsection",
    "docker-images-body",
    "Expand Docker images",
    "Collapse Docker images",
    "dockerImgSubBound",
    connectMetricsStream
  );
  applySubsectionCollapsed(
    DOCKER_VOL_COLLAPSED_KEY,
    "docker-volumes-subsection",
    "docker-volumes-body",
    "Expand Docker volumes",
    "Collapse Docker volumes"
  );
  initSubsectionCollapse(
    DOCKER_VOL_COLLAPSED_KEY,
    "docker-volumes-subsection",
    "docker-volumes-body",
    "Expand Docker volumes",
    "Collapse Docker volumes",
    "dockerVolSubBound",
    connectMetricsStream
  );
}

const DISK_IO_SORT_KEYDIR_KEY = "mc-disk-io-sort-keydir";

/** @type {"device"|"read"|"write"|"rx"|"tx"} */
let diskIoSortColumn = "device";
/** @type {"asc"|"desc"} */
let diskIoSortDir = "asc";

function normalizeDiskIoSortColumn(k) {
  if (k === "read" || k === "write" || k === "device" || k === "rx" || k === "tx") return k;
  return "device";
}

function loadDiskIoSortKeyDir() {
  try {
    const raw = localStorage.getItem(DISK_IO_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        diskIoSortColumn = normalizeDiskIoSortColumn(o.column || o.key);
        diskIoSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveDiskIoSortKeyDir() {
  try {
    localStorage.setItem(
      DISK_IO_SORT_KEYDIR_KEY,
      JSON.stringify({ column: diskIoSortColumn, dir: diskIoSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function defaultDirForDiskIoColumn(col) {
  if (col === "device") return "asc";
  return "desc";
}

function onDiskIoColumnHeaderClick(key) {
  const c = normalizeDiskIoSortColumn(key);
  if (diskIoSortColumn === c) {
    diskIoSortDir = diskIoSortDir === "asc" ? "desc" : "asc";
  } else {
    diskIoSortColumn = c;
    diskIoSortDir = defaultDirForDiskIoColumn(c);
  }
  saveDiskIoSortKeyDir();
  renderDiskIo(lastDiskIo);
}

function diskIoSortAriaSort(col) {
  if (diskIoSortColumn !== col) return "none";
  return diskIoSortDir === "asc" ? "ascending" : "descending";
}

function diskIoSortArrowHtml(col) {
  if (diskIoSortColumn !== col) return "";
  const ch = diskIoSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function cmpDiskIoRows(a, b) {
  const dir = diskIoSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (diskIoSortColumn) {
    case "device":
      cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "read":
      cmp = (a.read_bps || 0) - (b.read_bps || 0);
      break;
    case "write":
      cmp = (a.write_bps || 0) - (b.write_bps || 0);
      break;
    case "rx":
      cmp = (Number(a.read_bytes) || 0) - (Number(b.read_bytes) || 0);
      break;
    case "tx":
      cmp = (Number(a.write_bytes) || 0) - (Number(b.write_bytes) || 0);
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base", numeric: true });
}

function initDiskIoSortHeaderClicks() {
  const host = document.getElementById("panel-body-storage");
  if (!host || host.dataset.diskIoSortBound === "1") return;
  host.dataset.diskIoSortBound = "1";
  host.addEventListener("click", (e) => {
    const th = e.target.closest("th.disk-io-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    onDiskIoColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const th = e.target.closest("th.disk-io-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    e.preventDefault();
    onDiskIoColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
}

function initDiskIoRowClicks() {
  const wrap = document.getElementById("disk-io-table");
  if (!wrap || wrap.dataset.diskIoRowBound === "1") return;
  wrap.dataset.diskIoRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.disk-io-row-detail[data-devname]");
    if (!tr || !wrap.contains(tr)) return;
    const enc = tr.getAttribute("data-devname") || "";
    let name = "";
    try {
      name = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!name) return;
    openBlockDevDetailModal(name);
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.disk-io-row-detail[data-devname]");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const enc = tr.getAttribute("data-devname") || "";
    let name = "";
    try {
      name = decodeURIComponent(enc);
    } catch (_) {
      return;
    }
    if (!name) return;
    openBlockDevDetailModal(name);
  });
}

function renderDiskIo(dio) {
  const wrap = document.getElementById("disk-io-table");
  if (!wrap) return;
  if (!dio || !dio.devices || !Object.keys(dio.devices).length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No block devices in /proc/diskstats</p>";
    return;
  }
  const rates = dio.rates || {};
  const list = Object.keys(dio.devices).map((name) => {
    const d = dio.devices[name] || {};
    return {
      name,
      read_bytes: Number(d.read_bytes),
      write_bytes: Number(d.write_bytes),
      read_bps: Number(rates[name] && rates[name].read_bps) || 0,
      write_bps: Number(rates[name] && rates[name].write_bps) || 0,
    };
  });
  list.sort(cmpDiskIoRows);
  const rows = list
    .map((row) => {
      const rxd = Number.isFinite(row.read_bytes) ? formatBytes(row.read_bytes) : "—";
      const txd = Number.isFinite(row.write_bytes) ? formatBytes(row.write_bytes) : "—";
      const enc = encodeURIComponent(row.name);
      return `<tr class="disk-io-row-detail" role="button" tabindex="0" data-devname="${enc}" title="Device details" aria-label="Open details for block device ${escapeHtml(
        row.name
      )}"><td class="disk-io-td-name">${escapeHtml(row.name)}</td><td class="disk-io-td-metric">${escapeHtml(
        formatBytesPerSec(row.read_bps)
      )}</td><td class="disk-io-td-metric">${escapeHtml(
        formatBytesPerSec(row.write_bps)
      )}</td><td class="disk-io-td-metric disk-io-td-bytes" title="Sectors read (cumulative)">${escapeHtml(
        rxd
      )}</td><td class="disk-io-td-metric disk-io-td-bytes" title="Sectors written (cumulative)">${escapeHtml(
        txd
      )}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table mc-table-disk-io" aria-label="Block device I/O from diskstats"><thead><tr>
      <th class="disk-io-th disk-io-sortable" scope="col" data-sort-key="device" role="columnheader" tabindex="0" aria-sort="${diskIoSortAriaSort("device")}">Device${diskIoSortArrowHtml("device")}</th>
      <th class="disk-io-th disk-io-sortable disk-io-th-metric" scope="col" data-sort-key="read" role="columnheader" tabindex="0" aria-sort="${diskIoSortAriaSort("read")}">Read/s${diskIoSortArrowHtml("read")}</th>
      <th class="disk-io-th disk-io-sortable disk-io-th-metric" scope="col" data-sort-key="write" role="columnheader" tabindex="0" aria-sort="${diskIoSortAriaSort("write")}">Write/s${diskIoSortArrowHtml("write")}</th>
      <th class="disk-io-th disk-io-sortable disk-io-th-metric" scope="col" data-sort-key="rx" role="columnheader" tabindex="0" aria-sort="${diskIoSortAriaSort("rx")}" title="Cumulative bytes read">Read${diskIoSortArrowHtml("rx")}</th>
      <th class="disk-io-th disk-io-sortable disk-io-th-metric" scope="col" data-sort-key="tx" role="columnheader" tabindex="0" aria-sort="${diskIoSortAriaSort("tx")}" title="Cumulative bytes written">Write${diskIoSortArrowHtml("tx")}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

const THERMAL_SORT_KEYDIR_KEY = "mc-thermal-sort-keydir";
const FAN_SORT_KEYDIR_KEY = "mc-fan-sort-keydir";

/** @type {"name"|"temp"} */
let thermalSortColumn = "name";
/** @type {"asc"|"desc"} */
let thermalSortDir = "asc";

/** @type {"name"|"rpm"} */
let fanSortColumn = "name";
/** @type {"asc"|"desc"} */
let fanSortDir = "asc";

function normalizeThermalSortColumn(k) {
  if (k === "name" || k === "temp") return k;
  return "name";
}

function loadThermalSortKeyDir() {
  try {
    const raw = localStorage.getItem(THERMAL_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        thermalSortColumn = normalizeThermalSortColumn(o.column || o.key);
        thermalSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveThermalSortKeyDir() {
  try {
    localStorage.setItem(
      THERMAL_SORT_KEYDIR_KEY,
      JSON.stringify({ column: thermalSortColumn, dir: thermalSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function defaultDirForThermalColumn(col) {
  if (col === "name") return "asc";
  return "desc";
}

function onThermalColumnHeaderClick(key) {
  const c = normalizeThermalSortColumn(key);
  if (thermalSortColumn === c) {
    thermalSortDir = thermalSortDir === "asc" ? "desc" : "asc";
  } else {
    thermalSortColumn = c;
    thermalSortDir = defaultDirForThermalColumn(c);
  }
  saveThermalSortKeyDir();
  renderThermal(lastThermal);
}

function thermalSortAriaSort(col) {
  if (thermalSortColumn !== col) return "none";
  return thermalSortDir === "asc" ? "ascending" : "descending";
}

function thermalSortArrowHtml(col) {
  if (thermalSortColumn !== col) return "";
  const ch = thermalSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function cmpThermalRows(a, b) {
  const dir = thermalSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (thermalSortColumn) {
    case "name":
      cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
      break;
    case "temp": {
      const ac = Number(a.cur);
      const bc = Number(b.cur);
      const af = Number.isFinite(ac) ? ac : NaN;
      const bf = Number.isFinite(bc) ? bc : NaN;
      if (!Number.isFinite(af) && !Number.isFinite(bf)) cmp = 0;
      else if (!Number.isFinite(af)) cmp = 1;
      else if (!Number.isFinite(bf)) cmp = -1;
      else cmp = af - bf;
      break;
    }
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
}

function normalizeFanSortColumn(k) {
  if (k === "name" || k === "rpm") return k;
  return "name";
}

function loadFanSortKeyDir() {
  try {
    const raw = localStorage.getItem(FAN_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        fanSortColumn = normalizeFanSortColumn(o.column || o.key);
        fanSortDir = o.dir === "desc" ? "desc" : "asc";
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function saveFanSortKeyDir() {
  try {
    localStorage.setItem(
      FAN_SORT_KEYDIR_KEY,
      JSON.stringify({ column: fanSortColumn, dir: fanSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function defaultDirForFanColumn(col) {
  if (col === "name") return "asc";
  return "desc";
}

function onFanColumnHeaderClick(key) {
  const c = normalizeFanSortColumn(key);
  if (fanSortColumn === c) {
    fanSortDir = fanSortDir === "asc" ? "desc" : "asc";
  } else {
    fanSortColumn = c;
    fanSortDir = defaultDirForFanColumn(c);
  }
  saveFanSortKeyDir();
  renderFans(lastFans);
}

function fanSortAriaSort(col) {
  if (fanSortColumn !== col) return "none";
  return fanSortDir === "asc" ? "ascending" : "descending";
}

function fanSortArrowHtml(col) {
  if (fanSortColumn !== col) return "";
  const ch = fanSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function cmpFanRows(a, b) {
  const dir = fanSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (fanSortColumn) {
    case "name":
      cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "rpm": {
      const ar = Number(a.rpm);
      const br = Number(b.rpm);
      const af = Number.isFinite(ar) ? ar : NaN;
      const bf = Number.isFinite(br) ? br : NaN;
      if (!Number.isFinite(af) && !Number.isFinite(bf)) cmp = 0;
      else if (!Number.isFinite(af)) cmp = 1;
      else if (!Number.isFinite(bf)) cmp = -1;
      else cmp = af - bf;
      break;
    }
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function initThermalSortHeaderClicks() {
  const host = document.getElementById("panel-body-thermal");
  if (!host || host.dataset.thermalSortBound === "1") return;
  host.dataset.thermalSortBound = "1";
  host.addEventListener("click", (e) => {
    const thThermal = e.target.closest("th.thermal-sortable[data-sort-key]");
    if (thThermal && host.contains(thThermal)) {
      onThermalColumnHeaderClick(thThermal.getAttribute("data-sort-key") || "");
      return;
    }
    const thFan = e.target.closest("th.fan-sortable[data-sort-key]");
    if (thFan && host.contains(thFan)) {
      onFanColumnHeaderClick(thFan.getAttribute("data-sort-key") || "");
    }
  });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const thThermal = e.target.closest("th.thermal-sortable[data-sort-key]");
    if (thThermal && host.contains(thThermal)) {
      e.preventDefault();
      onThermalColumnHeaderClick(thThermal.getAttribute("data-sort-key") || "");
      return;
    }
    const thFan = e.target.closest("th.fan-sortable[data-sort-key]");
    if (thFan && host.contains(thFan)) {
      e.preventDefault();
      onFanColumnHeaderClick(thFan.getAttribute("data-sort-key") || "");
    }
  });
}

function thermalTempClass(cur, high, crit) {
  if (crit != null && Number.isFinite(cur) && cur >= crit) return "thermal-td-crit";
  if (high != null && Number.isFinite(cur) && cur >= high) return "thermal-td-warn";
  return "";
}

function renderThermal(data) {
  const wrap = document.getElementById("thermal-table");
  if (!wrap) return;
  if (!data) {
    wrap.innerHTML = "<p class=\"tile-meta\">No data.</p>";
    return;
  }
  const chips = data.chips || {};
  const zones = data.zones || [];
  const rows = [];
  for (const [chip, readings] of Object.entries(chips)) {
    for (const r of readings) {
      const name = `${chip}${r.label ? ` ${r.label}` : ""}`.trim();
      const cur = r.current_c;
      const hi = r.high_c != null ? r.high_c : null;
      const cr = r.critical_c != null ? r.critical_c : null;
      const cls = thermalTempClass(cur, hi, cr);
      const limits =
        hi != null || cr != null
          ? [hi != null ? `high ${hi}°C` : null, cr != null ? `crit ${cr}°C` : null].filter(Boolean).join(" · ")
          : "";
      const dk = typeof r.detail_key === "string" ? r.detail_key : "";
      rows.push({ name, cur, cls, limits, sub: "hwmon", detail_key: dk });
    }
  }
  for (const z of zones) {
    const dk = typeof z.detail_key === "string" ? z.detail_key : "";
    rows.push({
      name: z.name || "zone",
      cur: z.current_c,
      cls: "",
      limits: "",
      sub: "thermal zone",
      detail_key: dk,
    });
  }
  rows.sort(cmpThermalRows);
  if (!rows.length) {
    wrap.innerHTML =
      "<p class=\"tile-meta\">No thermal sensors found (try sensors/lm-sensors; thermal zones may still appear).</p>";
    return;
  }
  const tr = rows
    .map((row) => {
      const limDisp = row.limits || (row.sub === "thermal zone" ? "zone" : "—");
      const tempCell =
        row.cur != null && Number.isFinite(row.cur) ? escapeHtml(`${row.cur.toFixed(1)} °C`) : "—";
      const hasKey = row.detail_key && row.detail_key.length > 0;
      const rowClass = hasKey ? "thermal-row-detail" : "";
      const roleAttr = hasKey ? ' role="button" tabindex="0"' : "";
      const titleAttr = hasKey ? " title=\"Sensor details\"" : "";
      const aria = hasKey
        ? ` aria-label="Open details for ${escapeHtml(row.name)}"`
        : "";
      const dkAttr = hasKey ? ` data-detail-key="${escapeHtml(row.detail_key)}"` : "";
      return `<tr class="${rowClass}"${roleAttr}${titleAttr}${aria}${dkAttr}><td class="thermal-td-name">${escapeHtml(row.name)}</td><td class="thermal-td-metric ${row.cls}" title="${escapeHtml(row.limits)}">${tempCell}</td><td class="thermal-td-meta">${escapeHtml(limDisp)}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table mc-table-thermal" aria-label="Temperature sensors"><thead><tr>
      <th class="thermal-th thermal-sortable" scope="col" data-sort-key="name" role="columnheader" tabindex="0" aria-sort="${thermalSortAriaSort("name")}">Sensor${thermalSortArrowHtml("name")}</th>
      <th class="thermal-th thermal-th-metric thermal-sortable" scope="col" data-sort-key="temp" role="columnheader" tabindex="0" aria-sort="${thermalSortAriaSort("temp")}">Temp${thermalSortArrowHtml("temp")}</th>
      <th class="thermal-th thermal-th-meta" scope="col">Limits</th>
    </tr></thead><tbody>${tr}</tbody></table>`;
}

function renderFans(data) {
  const wrap = document.getElementById("thermal-fans-table");
  if (!wrap) return;
  if (!data || !data.chips || !Object.keys(data.chips).length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No fan sensors found (hwmon / lm-sensors).</p>";
    return;
  }
  const rows = [];
  for (const [chip, readings] of Object.entries(data.chips)) {
    let idx = 0;
    for (const r of readings) {
      idx += 1;
      const lbl = typeof r.label === "string" ? r.label.trim() : "";
      const name = lbl ? `${chip} ${lbl}` : `${chip} fan ${idx}`;
      const rpm = r.rpm != null ? Number(r.rpm) : NaN;
      const dk = typeof r.detail_key === "string" ? r.detail_key.trim() : "";
      rows.push({
        name,
        rpm: Number.isFinite(rpm) ? rpm : null,
        detail_key: dk,
      });
    }
  }
  rows.sort(cmpFanRows);
  const tr = rows
    .map((row) => {
      const rpmCell =
        row.rpm != null && Number.isFinite(row.rpm) ? escapeHtml(String(row.rpm)) : "—";
      const hasKey = row.detail_key && row.detail_key.length > 0;
      const rowClass = hasKey ? "fan-row-detail" : "";
      const roleAttr = hasKey ? ' role="button" tabindex="0"' : "";
      const titleAttr = hasKey ? ' title="Fan details"' : "";
      const aria = hasKey
        ? ` aria-label="Open details for ${escapeHtml(row.name)}"`
        : "";
      const dkAttr = hasKey ? ` data-detail-key="${escapeHtml(row.detail_key)}"` : "";
      return `<tr class="${rowClass}"${roleAttr}${titleAttr}${aria}${dkAttr}><td class="fan-td-name">${escapeHtml(row.name)}</td><td class="fan-td-rpm">${rpmCell}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table mc-table-fans" aria-label="Fan speeds"><thead><tr>
      <th class="fan-th fan-sortable" scope="col" data-sort-key="name" role="columnheader" tabindex="0" aria-sort="${fanSortAriaSort("name")}">Fan${fanSortArrowHtml("name")}</th>
      <th class="fan-th fan-th-rpm fan-sortable fan-th-metric" scope="col" data-sort-key="rpm" role="columnheader" tabindex="0" aria-sort="${fanSortAriaSort("rpm")}">RPM${fanSortArrowHtml("rpm")}</th>
    </tr></thead><tbody>${tr}</tbody></table>`;
}

function initThermalRowClicks() {
  const wrap = document.getElementById("thermal-table");
  if (!wrap || wrap.dataset.thermalRowBound === "1") return;
  wrap.dataset.thermalRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.thermal-row-detail[data-detail-key]");
    if (!tr || !wrap.contains(tr)) return;
    const k = tr.getAttribute("data-detail-key") || "";
    if (!k) return;
    openThermalDetailModal(k, tr.querySelector(".thermal-td-name")?.textContent || "");
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.thermal-row-detail[data-detail-key]");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const k = tr.getAttribute("data-detail-key") || "";
    if (!k) return;
    openThermalDetailModal(k, tr.querySelector(".thermal-td-name")?.textContent || "");
  });
}

function initFanRowClicks() {
  const wrap = document.getElementById("thermal-fans-table");
  if (!wrap || wrap.dataset.fanRowBound === "1") return;
  wrap.dataset.fanRowBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.fan-row-detail[data-detail-key]");
    if (!tr || !wrap.contains(tr)) return;
    const k = tr.getAttribute("data-detail-key") || "";
    if (!k) return;
    openFanDetailModal(k, tr.querySelector(".fan-td-name")?.textContent || "");
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.fan-row-detail[data-detail-key]");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const k = tr.getAttribute("data-detail-key") || "";
    if (!k) return;
    openFanDetailModal(k, tr.querySelector(".fan-td-name")?.textContent || "");
  });
}

function initThermalPanel() {
  loadThermalSortKeyDir();
  loadFanSortKeyDir();
  initThermalSortHeaderClicks();
  initThermalRowClicks();
  initFanRowClicks();
  applySubsectionCollapsed(
    THERMAL_SENSORS_COLLAPSED_KEY,
    "thermal-sensors-subsection",
    "thermal-sensors-body",
    "Expand Sensors",
    "Collapse Sensors"
  );
  initSubsectionCollapse(
    THERMAL_SENSORS_COLLAPSED_KEY,
    "thermal-sensors-subsection",
    "thermal-sensors-body",
    "Expand Sensors",
    "Collapse Sensors",
    "thermalSensorsSubBound",
    connectMetricsStream
  );
  applySubsectionCollapsed(
    THERMAL_FANS_COLLAPSED_KEY,
    "thermal-fans-subsection",
    "thermal-fans-body",
    "Expand Fans",
    "Collapse Fans"
  );
  initSubsectionCollapse(
    THERMAL_FANS_COLLAPSED_KEY,
    "thermal-fans-subsection",
    "thermal-fans-body",
    "Expand Fans",
    "Collapse Fans",
    "thermalFansSubCollapseBound",
    connectMetricsStream
  );
}

function closeThermalDetailModal() {
  const backdrop = document.getElementById("thermal-detail-backdrop");
  const dialog = document.getElementById("thermal-detail-dialog");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
  }
}

function renderThermalDetailHtml(data) {
  if (!data) return "<p class=\"tile-meta\">No data.</p>";
  let html = "<dl class=\"proc-detail-dl\">";
  const pri = ["kind", "path", "hwmon_chip_name", "detail_key", "ts"];
  const shown = new Set();
  for (const k of pri) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    const v = data[k];
    if (v == null) continue;
    shown.add(k);
    const label =
      k === "hwmon_chip_name"
        ? "Hwmon chip"
        : k === "detail_key"
          ? "Key"
          : k;
    if (k === "ts" && typeof v === "number") {
      html += `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(
        `${v} (${new Date(v * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })})`
      )}</dd>`;
      continue;
    }
    html += `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(v))}</dd>`;
  }
  const fields = data.fields;
  if (fields && typeof fields === "object") {
    shown.add("fields");
    const lines = Object.keys(fields)
      .sort()
      .map((fk) => `${fk}: ${fields[fk]}`);
    html += `<dt>sysfs</dt><dd><pre class="proc-detail-json proc-detail-json-inline">${escapeHtml(
      lines.join("\n")
    )}</pre></dd>`;
  }
  html += "</dl>";
  html +=
    "<details class=\"proc-detail-raw\"><summary>All fields (JSON)</summary>" +
    `<pre class="proc-detail-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
  return html;
}

function openThermalDetailModal(detailKey, displayName) {
  const backdrop = document.getElementById("thermal-detail-backdrop");
  const dialog = document.getElementById("thermal-detail-dialog");
  const body = document.getElementById("thermal-detail-body");
  const title = document.getElementById("thermal-detail-title");
  if (!backdrop || !dialog || !body || !title) return;

  title.textContent = displayName || detailKey;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");

  document.getElementById("thermal-detail-close")?.focus();

  const q = encodeURIComponent(detailKey);
  fetch(`/api/thermal/detail?key=${q}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Sensor not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = displayName || detailKey;
      body.innerHTML = renderThermalDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = displayName || detailKey;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function openFanDetailModal(detailKey, displayName) {
  const backdrop = document.getElementById("thermal-detail-backdrop");
  const dialog = document.getElementById("thermal-detail-dialog");
  const body = document.getElementById("thermal-detail-body");
  const title = document.getElementById("thermal-detail-title");
  if (!backdrop || !dialog || !body || !title) return;

  title.textContent = displayName || detailKey;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");

  document.getElementById("thermal-detail-close")?.focus();

  const q = encodeURIComponent(detailKey);
  fetch(`/api/fan/detail?key=${q}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Fan sensor not found.");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = displayName || detailKey;
      body.innerHTML = renderThermalDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = displayName || detailKey;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function initThermalDetailModal() {
  const backdrop = document.getElementById("thermal-detail-backdrop");
  const closeBtn = document.getElementById("thermal-detail-close");
  closeBtn?.addEventListener("click", closeThermalDetailModal);
  backdrop?.addEventListener("click", closeThermalDetailModal);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PROC_DETAIL_PRIORITY = [
  "pid",
  "ppid",
  "name",
  "status",
  "username",
  "terminal",
  "exe",
  "cwd",
  "create_time",
  "nice",
  "ionice",
  "cpu_num",
  "cpu_affinity",
  "cpu_percent",
  "cpu_percent_machine",
  "cpu_times",
  "memory_percent",
  "memory_info",
  "memory_full_info",
  "num_threads",
  "num_ctx_switches",
  "num_fds",
  "io_counters",
  "uids",
  "gids",
  "parent",
  "children_count",
  "open_files_count",
  "connections_count",
];

function formatProcessDetailScalar(key, val) {
  if (val == null) return "—";
  if (key === "create_time" && typeof val === "number") {
    try {
      const d = new Date(val * 1000);
      return `${val} (${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })})`;
    } catch (_) {
      return String(val);
    }
  }
  if (
    (key === "memory_info" || key === "memory_full_info") &&
    val &&
    typeof val === "object"
  ) {
    const parts = [];
    if (val.rss != null) parts.push(`rss ${formatBytes(val.rss)}`);
    if (val.vms != null) parts.push(`vms ${formatBytes(val.vms)}`);
    if (val.shared != null) parts.push(`shared ${formatBytes(val.shared)}`);
    if (val.data != null) parts.push(`data ${formatBytes(val.data)}`);
    if (val.lib != null) parts.push(`lib ${formatBytes(val.lib)}`);
    if (parts.length) return `${parts.join(" · ")} · ${JSON.stringify(val)}`;
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

function renderProcessDetailHtml(data) {
  if (!data) return "<p class=\"tile-meta\">No data.</p>";
  const skipRest = new Set([
    "cmdline",
    "open_files",
    "connections",
    "children",
    "threads",
    "ts",
  ]);
  const shown = new Set();
  let html = "<dl class=\"proc-detail-dl\">";
  for (const k of PROC_DETAIL_PRIORITY) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    const v = data[k];
    if (v == null && k !== "cpu_percent" && k !== "cpu_percent_machine" && k !== "memory_percent") continue;
    shown.add(k);
    html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(formatProcessDetailScalar(k, v))}</dd>`;
  }
  const restKeys = Object.keys(data).filter(
    (k) => !shown.has(k) && !skipRest.has(k) && k !== "error"
  );
  restKeys.sort();
  for (const k of restKeys) {
    const v = data[k];
    if (v == null) continue;
    html += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(formatProcessDetailScalar(k, v))}</dd>`;
  }
  html += "</dl>";
  const cmdline = data.cmdline;
  const cmd =
    Array.isArray(cmdline) ? cmdline.join(" ") : typeof cmdline === "string" ? cmdline : "";
  if (cmd) {
    html +=
      "<div class=\"proc-detail-cmdwrap\"><div class=\"proc-detail-cmdlabel\">Command line</div>" +
      `<pre class="proc-detail-cmd">${escapeHtml(cmd)}</pre></div>`;
  }
  html +=
    "<details class=\"proc-detail-raw\"><summary>All fields (JSON)</summary>" +
    `<pre class="proc-detail-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
  return html;
}

function closeProcessDetailModal() {
  const backdrop = document.getElementById("proc-detail-backdrop");
  const dialog = document.getElementById("proc-detail-dialog");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  }
  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
  }
}

function openProcessDetailModal(pid) {
  const backdrop = document.getElementById("proc-detail-backdrop");
  const dialog = document.getElementById("proc-detail-dialog");
  const body = document.getElementById("proc-detail-body");
  const title = document.getElementById("proc-detail-title");
  if (!backdrop || !dialog || !body || !title) return;

  title.textContent = `PID ${pid}`;
  body.innerHTML = "<p class=\"tile-meta\">Loading…</p>";
  backdrop.hidden = false;
  dialog.hidden = false;
  backdrop.setAttribute("aria-hidden", "false");
  dialog.setAttribute("aria-hidden", "false");

  const closeBtn = document.getElementById("proc-detail-close");
  closeBtn?.focus();

  fetch(`/api/process/${pid}`)
    .then((res) => {
      if (res.status === 404) throw new Error("Process not found (it may have exited).");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      return res.json();
    })
    .then((d) => {
      title.textContent = `${d.name || "Process"} (PID ${d.pid})`;
      body.innerHTML = renderProcessDetailHtml(d);
    })
    .catch((err) => {
      title.textContent = `PID ${pid}`;
      body.innerHTML = `<p class="tile-meta">${escapeHtml(err.message || String(err))}</p>`;
    });
}

function initProcessDetailModal() {
  const backdrop = document.getElementById("proc-detail-backdrop");
  const closeBtn = document.getElementById("proc-detail-close");
  closeBtn?.addEventListener("click", closeProcessDetailModal);
  backdrop?.addEventListener("click", closeProcessDetailModal);
}

function initProcessTableRowClicks() {
  const wrap = document.getElementById("proc-table");
  if (!wrap || wrap.dataset.procRowDetailBound === "1") return;
  wrap.dataset.procRowDetailBound = "1";
  wrap.addEventListener("click", (e) => {
    const tr = e.target.closest("tbody tr.proc-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    const pid = parseInt(tr.getAttribute("data-pid") || "", 10);
    if (!Number.isFinite(pid)) return;
    openProcessDetailModal(pid);
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tbody tr.proc-row-detail");
    if (!tr || !wrap.contains(tr)) return;
    e.preventDefault();
    const pid = parseInt(tr.getAttribute("data-pid") || "", 10);
    if (!Number.isFinite(pid)) return;
    openProcessDetailModal(pid);
  });
}

let lastProcesses = [];
let lastSnapshotLogicalCpus = 1;
let lastAptPackages = null;
const APT_PACKAGES_EXPANDED_KEY = "mc-ops-apt-packages-expanded";
const APT_PKG_SEARCH_KEY = "mc-apt-pkg-search";
const APT_PKG_SORT_DIR_KEY = "mc-apt-pkg-sort-dir";
let aptPackagesExpanded = false;
/** @type {"asc"|"desc"} */
let aptPkgSortDir = "asc";
const PROC_PREFS_KEY = "mc-proc-prefs";
const PROC_FOOTER_RSS_TOTAL_KEY = "mc-proc-footer-rss-total";

function loadProcFooterRssTotalVisible() {
  try {
    return localStorage.getItem(PROC_FOOTER_RSS_TOTAL_KEY) !== "0";
  } catch (_) {
    return true;
  }
}

function loadProcPrefs() {
  try {
    const raw = localStorage.getItem(PROC_PREFS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return o;
  } catch (_) {
    return null;
  }
}

function saveProcPrefs() {
  const search = document.getElementById("proc-search");
  const limit = document.getElementById("proc-limit");
  const prefs = {
    q: search ? search.value : "",
    limit: limit ? limit.value : "12",
  };
  try {
    localStorage.setItem(PROC_PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {
    /* ignore */
  }
}

function applyProcPrefsToForm() {
  const prefs = loadProcPrefs();
  if (!prefs) return;
  const search = document.getElementById("proc-search");
  const limit = document.getElementById("proc-limit");
  if (search != null && typeof prefs.q === "string") search.value = prefs.q;
  if (limit != null && prefs.limit != null) {
    const v = String(prefs.limit);
    if ([...limit.options].some((o) => o.value === v)) limit.value = v;
  }
}

function fmtProcPid(pid) {
  return String(pid).padStart(6, "\u2007");
}

function fmtProcPct(n) {
  return `${Number(n).toFixed(1).padStart(5, "\u2007")}%`;
}

const PROC_MEM_UNIT_KEY = "mc-proc-mem-unit";
const PROC_MEM_DISPLAY_KEY = "mc-proc-mem-display";
const PROC_CPU_SCALE_KEY = "mc-proc-cpu-scale";
let procMemUnit = "mb";
/** @type {"percent"|"bytes"|"both"} */
let procMemDisplay = "both";
/** @type {"machine"|"per_core"} */
let procCpuScale = "machine";

function loadProcCpuScale() {
  try {
    return localStorage.getItem(PROC_CPU_SCALE_KEY) === "per_core" ? "per_core" : "machine";
  } catch (_) {
    return "machine";
  }
}

function loadProcMemUnit() {
  try {
    return localStorage.getItem(PROC_MEM_UNIT_KEY) === "gb" ? "gb" : "mb";
  } catch (_) {
    return "mb";
  }
}

function loadProcMemDisplay() {
  try {
    const v = localStorage.getItem(PROC_MEM_DISPLAY_KEY);
    if (v === "percent" || v === "bytes" || v === "both") return v;
    return "both";
  } catch (_) {
    return "both";
  }
}

function syncProcMemUnitFieldVisibility() {
  const wrap = document.getElementById("proc-mem-unit-field");
  if (!wrap) return;
  wrap.hidden = procMemDisplay !== "bytes" && procMemDisplay !== "both";
}

function initProcMemUnitControl() {
  procMemUnit = loadProcMemUnit();
  procMemDisplay = loadProcMemDisplay();
  procCpuScale = loadProcCpuScale();

  const cpuScaleSel = document.getElementById("proc-cpu-scale-select");
  if (cpuScaleSel) {
    cpuScaleSel.value = procCpuScale;
    cpuScaleSel.addEventListener("change", () => {
      procCpuScale = cpuScaleSel.value === "per_core" ? "per_core" : "machine";
      try {
        localStorage.setItem(PROC_CPU_SCALE_KEY, procCpuScale);
      } catch (_) {
        /* ignore */
      }
      renderProcsTable();
    });
  }

  const displaySel = document.getElementById("proc-mem-display-select");
  if (displaySel) {
    displaySel.value = procMemDisplay;
    displaySel.addEventListener("change", () => {
      procMemDisplay =
        displaySel.value === "percent"
          ? "percent"
          : displaySel.value === "bytes"
            ? "bytes"
            : "both";
      try {
        localStorage.setItem(PROC_MEM_DISPLAY_KEY, procMemDisplay);
      } catch (_) {
        /* ignore */
      }
      syncProcMemUnitFieldVisibility();
      renderProcsTable();
    });
  }

  const sel = document.getElementById("proc-mem-unit-select");
  if (sel) {
    sel.value = procMemUnit;
    sel.addEventListener("change", () => {
      procMemUnit = sel.value === "gb" ? "gb" : "mb";
      try {
        localStorage.setItem(PROC_MEM_UNIT_KEY, procMemUnit);
      } catch (_) {
        /* ignore */
      }
      renderProcsTable();
    });
  }

  syncProcMemUnitFieldVisibility();
}

function fmtProcMemAbs(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b < 0) return "—";
  if (procMemUnit === "gb") {
    const gb = b / (1024 * 1024 * 1024);
    const t = gb < 10 ? gb.toFixed(2) : gb.toFixed(1);
    return `${t} GB`;
  }
  const mb = b / (1024 * 1024);
  const t = mb < 100 ? mb.toFixed(1) : mb.toFixed(0);
  return `${t} MB`;
}

function fmtProcMemCell(p) {
  const pct = fmtProcPct(p.memory_percent);
  const abs = escapeHtml(fmtProcMemAbs(p.memory_rss));
  if (procMemDisplay === "percent") {
    return pct;
  }
  if (procMemDisplay === "bytes") {
    return `<span class="proc-mem-abs">${abs}</span>`;
  }
  return `${pct}<span class="proc-mem-sep"> · </span><span class="proc-mem-abs">${abs}</span>`;
}

const PROC_SORT_KEYDIR_KEY = "mc-proc-sort-keydir";

const MC_SETTINGS_KEYS = [
  THEME_STORAGE_KEY,
  CLOCK_FORMAT_KEY,
  PANEL_VISIBILITY_KEY,
  PANEL_ORDER_KEY,
  PANEL_COLLAPSED_KEY,
  STORAGE_DISK_IO_COLLAPSED_KEY,
  HEADER_TITLE_KEY,
  HEADER_TITLE_VISIBLE_KEY,
  STREAM_PAUSED_KEY,
  UPDATE_INTERVAL_KEY,
  APT_PACKAGES_EXPANDED_KEY,
  APT_PKG_SEARCH_KEY,
  APT_PKG_SORT_DIR_KEY,
  PROC_PREFS_KEY,
  PROC_FOOTER_RSS_TOTAL_KEY,
  PROC_MEM_UNIT_KEY,
  PROC_MEM_DISPLAY_KEY,
  PROC_CPU_SCALE_KEY,
  PROC_SORT_KEYDIR_KEY,
  DISK_SORT_KEYDIR_KEY,
  DISK_IO_SORT_KEYDIR_KEY,
  THERMAL_SORT_KEYDIR_KEY,
  FAN_SORT_KEYDIR_KEY,
  THERMAL_SENSORS_COLLAPSED_KEY,
  THERMAL_FANS_COLLAPSED_KEY,
  NETWORK_INTERFACES_COLLAPSED_KEY,
  NETWORK_LISTEN_PORTS_COLLAPSED_KEY,
  STORAGE_MOUNTS_COLLAPSED_KEY,
  STORAGE_ZFS_COLLAPSED_KEY,
  NET_RATE_UNIT_KEY,
  NET_SORT_KEYDIR_KEY,
  LISTEN_PORTS_SORT_KEYDIR_KEY,
  LISTEN_PORTS_SEARCH_KEY,
  LISTEN_PORTS_PROTO_FILTER_KEY,
  LISTEN_PORTS_FAMILY_FILTER_KEY,
  DOCKER_CONT_COLLAPSED_KEY,
  DOCKER_IMG_COLLAPSED_KEY,
  DOCKER_VOL_COLLAPSED_KEY,
  DOCKER_CONT_SORT_KEYDIR_KEY,
  DOCKER_IMG_SORT_KEYDIR_KEY,
  DOCKER_VOL_SORT_KEYDIR_KEY,
  MODAL_WIDTH_KEY,
  CONTENT_LAYOUT_MAX_KEY,
  CONTENT_PADDING_KEY,
];

const MC_SETTINGS_KEY_SET = new Set(MC_SETTINGS_KEYS);
const SETTINGS_EXPORT_FORMAT = 1;

/** @type {"pid"|"name"|"cpu"|"mem"} */
let procSortColumn = "cpu";
/** @type {"asc"|"desc"} */
let procSortDir = "desc";

function normalizeProcSortColumn(k) {
  if (k === "memory") return "mem";
  if (k === "pid" || k === "name" || k === "cpu" || k === "mem") return k;
  return "cpu";
}

function loadProcSortKeyDir() {
  try {
    const raw = localStorage.getItem(PROC_SORT_KEYDIR_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        procSortColumn = normalizeProcSortColumn(o.column || o.key);
        procSortDir = o.dir === "asc" ? "asc" : "desc";
        return;
      }
    }
    const prefs = loadProcPrefs();
    if (prefs && (prefs.sort === "cpu" || prefs.sort === "memory")) {
      procSortColumn = prefs.sort === "memory" ? "mem" : "cpu";
      procSortDir = "desc";
      saveProcSortKeyDir();
    }
  } catch (_) {
    /* ignore */
  }
}

function saveProcSortKeyDir() {
  try {
    localStorage.setItem(
      PROC_SORT_KEYDIR_KEY,
      JSON.stringify({ column: procSortColumn, dir: procSortDir })
    );
  } catch (_) {
    /* ignore */
  }
}

function defaultDirForProcColumn(col) {
  if (col === "name" || col === "pid") return "asc";
  return "desc";
}

function onProcColumnHeaderClick(col) {
  const c = normalizeProcSortColumn(col);
  if (procSortColumn === c) {
    procSortDir = procSortDir === "asc" ? "desc" : "asc";
  } else {
    procSortColumn = c;
    procSortDir = defaultDirForProcColumn(c);
  }
  saveProcSortKeyDir();
  renderProcsTable();
}

function cmpProcRows(a, b) {
  const dir = procSortDir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (procSortColumn) {
    case "pid":
      cmp = (a.pid || 0) - (b.pid || 0);
      break;
    case "name":
      cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      break;
    case "cpu":
      if (procCpuScale === "per_core") {
        cmp = (a.cpu_percent || 0) - (b.cpu_percent || 0);
      } else {
        cmp = (a.cpu_percent_machine || 0) - (b.cpu_percent_machine || 0);
      }
      break;
    case "mem":
      if (procMemDisplay === "percent") {
        cmp = (a.memory_percent || 0) - (b.memory_percent || 0);
      } else {
        cmp = (a.memory_rss || 0) - (b.memory_rss || 0);
      }
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return dir * cmp;
  return (a.pid || 0) - (b.pid || 0);
}

function procSortAriaSort(col) {
  if (procSortColumn !== col) return "none";
  return procSortDir === "asc" ? "ascending" : "descending";
}

function procSortArrowHtml(col) {
  if (procSortColumn !== col) return "";
  const ch = procSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function initProcSortHeaderClicks() {
  const host = document.getElementById("panel-body-processes");
  if (!host || host.dataset.procSortBound === "1") return;
  host.dataset.procSortBound = "1";
  host.addEventListener("click", (e) => {
    const th = e.target.closest("th.proc-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    onProcColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const th = e.target.closest("th.proc-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    e.preventDefault();
    onProcColumnHeaderClick(th.getAttribute("data-sort-key") || "");
  });
}

function renderProcsTable() {
  const wrap = document.getElementById("proc-table");
  if (!wrap) return;

  const searchEl = document.getElementById("proc-search");
  const limitEl = document.getElementById("proc-limit");

  const q = (searchEl && searchEl.value ? searchEl.value : "").trim().toLowerCase();
  let limit = parseInt(limitEl && limitEl.value ? limitEl.value : "12", 10);
  if (!Number.isFinite(limit) || limit < 0) limit = 12;
  const showAllRows = limit === 0;
  if (!showAllRows) limit = Math.min(100_000, limit);

  const raw = lastProcesses || [];
  if (!raw.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">—</p>";
    return;
  }

  let list = raw.map((p) => {
    const cpuRaw = Number(p.cpu_percent) || 0;
    let cpuM = Number(p.cpu_percent_machine);
    if (!Number.isFinite(cpuM)) {
      cpuM = cpuRaw / Math.max(1, lastSnapshotLogicalCpus || 1);
    }
    return {
      pid: p.pid,
      name: p.name,
      cpu_percent: cpuRaw,
      cpu_percent_machine: cpuM,
      memory_percent: Number(p.memory_percent) || 0,
      memory_rss: Number(p.memory_rss) || 0,
    };
  });

  if (q) {
    list = list.filter((p) => String(p.name || "").toLowerCase().includes(q));
  }

  list.sort(cmpProcRows);

  const totalMatching = list.length;
  const shown = showAllRows ? list : list.slice(0, limit);

  const meta =
    totalMatching === 0 && q
      ? `<p class="proc-table-meta">No matches for '${escapeHtml(q)}' · ${raw.length} processes in sample</p>`
      : `<p class="proc-table-meta">Showing ${shown.length} of ${totalMatching}${q ? " matching" : ""} · ${raw.length} in sample · click a row for details</p>`;

  if (!shown.length) {
    wrap.innerHTML =
      meta +
      (totalMatching === 0 && q
        ? ""
        : "<p class=\"tile-meta\">—</p>");
    return;
  }

  const memColW = procMemDisplay === "percent" ? "4.25rem" : "8.5rem";

  const cpuThTitle =
    procCpuScale === "per_core"
      ? "Per logical CPU (100% = one core; can exceed 100%). Hover a row for share of all CPUs."
      : "Share of all logical CPUs (matches Compute). Hover a row for per-core %.";

  const rows = shown
    .map((p) => {
      const cpuMain = procCpuScale === "per_core" ? p.cpu_percent : p.cpu_percent_machine;
      const cpuTip =
        procCpuScale === "per_core"
          ? `All CPUs: ${fmtProcPct(p.cpu_percent_machine).trim()}`
          : `Per logical CPU: ${fmtProcPct(p.cpu_percent).trim()}`;
      return `<tr class="proc-row-detail" role="button" tabindex="0" data-pid="${
        p.pid
      }" title="Process details" aria-label="Open details for process ${p.pid}"><td class="proc-td-pid">${fmtProcPid(
        p.pid
      )}</td><td class="proc-td-name" title="${escapeHtml(p.name)}">${escapeHtml(
        p.name
      )}</td><td class="proc-td-metric" title="${escapeHtml(cpuTip)}">${fmtProcPct(
        cpuMain
      )}</td><td class="proc-td-metric proc-td-mem">${fmtProcMemCell(p)}</td></tr>`;
    })
    .join("");

  const totalRss = shown.reduce((s, p) => s + (Number(p.memory_rss) || 0), 0);
  const footer =
    loadProcFooterRssTotalVisible()
      ? `<tfoot><tr class="proc-tfoot-row">
      <td class="proc-td-pid"></td>
      <td class="proc-td-name proc-tfoot-label">Total · ${shown.length} shown</td>
      <td class="proc-td-metric proc-tfoot-metric">—</td>
      <td class="proc-td-metric proc-td-mem proc-tfoot-mem"><span class="proc-mem-abs">${escapeHtml(
        fmtProcMemAbs(totalRss)
      )}</span></td>
    </tr></tfoot>`
      : "";

  wrap.innerHTML =
    meta +
    `<table class="mc-table mc-table-procs"><colgroup>
      <col class="proc-col-pid" />
      <col />
      <col style="width:4.25rem" />
      <col style="width:${memColW}" />
    </colgroup><thead><tr>
      <th class="proc-th proc-th-pid proc-sortable" scope="col" data-sort-key="pid" role="columnheader" tabindex="0" aria-sort="${procSortAriaSort("pid")}">PID${procSortArrowHtml("pid")}</th>
      <th class="proc-th proc-th-name proc-sortable" scope="col" data-sort-key="name" role="columnheader" tabindex="0" aria-sort="${procSortAriaSort("name")}">Name${procSortArrowHtml("name")}</th>
      <th class="proc-th proc-th-metric proc-sortable" scope="col" data-sort-key="cpu" role="columnheader" tabindex="0" aria-sort="${procSortAriaSort("cpu")}" title="${escapeHtml(cpuThTitle)}">CPU${procSortArrowHtml("cpu")}</th>
      <th class="proc-th proc-th-metric proc-sortable" scope="col" data-sort-key="mem" role="columnheader" tabindex="0" aria-sort="${procSortAriaSort("mem")}">MEM${procSortArrowHtml("mem")}</th>
    </tr></thead><tbody>${rows}</tbody>${footer}</table>`;
}

function initProcessControls() {
  applyProcPrefsToForm();
  loadProcSortKeyDir();
  initProcSortHeaderClicks();
  const search = document.getElementById("proc-search");
  const limit = document.getElementById("proc-limit");
  const footerChk = document.getElementById("proc-footer-rss-total");
  if (footerChk) {
    footerChk.checked = loadProcFooterRssTotalVisible();
    footerChk.addEventListener("change", () => {
      try {
        localStorage.setItem(PROC_FOOTER_RSS_TOTAL_KEY, footerChk.checked ? "1" : "0");
      } catch (_) {
        /* ignore */
      }
      renderProcsTable();
    });
  }
  const debouncedSaveSearch = debounce(() => saveProcPrefs(), 400);
  search?.addEventListener("input", () => {
    renderProcsTable();
    debouncedSaveSearch();
  });
  limit?.addEventListener("change", () => {
    saveProcPrefs();
    renderProcsTable();
    connectMetricsStream();
  });
  initProcessTableRowClicks();
  renderProcsTable();
}

function loadAptPackagesExpanded() {
  try {
    return localStorage.getItem(APT_PACKAGES_EXPANDED_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function setAptPackagesExpanded(on) {
  aptPackagesExpanded = on;
  try {
    localStorage.setItem(APT_PACKAGES_EXPANDED_KEY, on ? "1" : "0");
  } catch (_) {
    /* ignore */
  }
}

function loadAptPkgSearch() {
  try {
    return localStorage.getItem(APT_PKG_SEARCH_KEY) || "";
  } catch (_) {
    return "";
  }
}

function saveAptPkgSearch() {
  const el = document.getElementById("apt-packages-search");
  try {
    localStorage.setItem(APT_PKG_SEARCH_KEY, el ? el.value : "");
  } catch (_) {
    /* ignore */
  }
}

function loadAptPkgSortDir() {
  try {
    return localStorage.getItem(APT_PKG_SORT_DIR_KEY) === "desc" ? "desc" : "asc";
  } catch (_) {
    return "asc";
  }
}

function saveAptPkgSortDir() {
  try {
    localStorage.setItem(APT_PKG_SORT_DIR_KEY, aptPkgSortDir);
  } catch (_) {
    /* ignore */
  }
}

function cmpAptPkgRows(a, b) {
  const dir = aptPkgSortDir === "asc" ? 1 : -1;
  const cmp = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
  if (cmp !== 0) return dir * cmp;
  return String(a.current || "").localeCompare(String(b.current || ""), undefined, {
    numeric: true,
  });
}

function aptPkgSortAriaSort() {
  return aptPkgSortDir === "asc" ? "ascending" : "descending";
}

function aptPkgSortArrowHtml() {
  const ch = aptPkgSortDir === "asc" ? "\u2191" : "\u2193";
  return ` <span class="proc-sort-ind" aria-hidden="true">${ch}</span>`;
}

function onAptPkgSortHeaderClick() {
  aptPkgSortDir = aptPkgSortDir === "asc" ? "desc" : "asc";
  saveAptPkgSortDir();
  renderAptPackagesTable();
}

function initAptPackagesSortHeaderClicks() {
  const host = document.getElementById("apt-packages-detail");
  if (!host || host.dataset.aptSortBound === "1") return;
  host.dataset.aptSortBound = "1";
  host.addEventListener("click", (e) => {
    const th = e.target.closest("th.ops-apt-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    onAptPkgSortHeaderClick();
  });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const th = e.target.closest("th.ops-apt-sortable[data-sort-key]");
    if (!th || !host.contains(th)) return;
    e.preventDefault();
    onAptPkgSortHeaderClick();
  });
}

function renderAptPackagesTable() {
  const host = document.getElementById("apt-packages-table-host");
  if (!host) return;

  const raw = Array.isArray(lastAptPackages) ? lastAptPackages : [];
  if (!raw.length) {
    host.innerHTML = "";
    return;
  }

  const searchEl = document.getElementById("apt-packages-search");
  const q = (searchEl && searchEl.value ? searchEl.value : "").trim().toLowerCase();

  let list = raw.map((p) => ({
    name: p.name,
    current: p.current != null ? String(p.current) : "",
    candidate: p.candidate != null ? String(p.candidate) : "",
  }));

  if (q) {
    list = list.filter((p) => String(p.name || "").toLowerCase().includes(q));
  }

  list.sort(cmpAptPkgRows);

  const totalMatching = list.length;
  const totalAll = raw.length;

  const meta =
    totalMatching === 0 && q
      ? `<p class="proc-table-meta">No matches for '${escapeHtml(q)}' · ${totalAll} packages</p>`
      : `<p class="proc-table-meta">Showing ${totalMatching} of ${totalAll}${q ? " matching" : ""}</p>`;

  if (!totalMatching) {
    host.innerHTML = meta;
    return;
  }

  const rows = list
    .map(
      (p) =>
        `<tr><td class="ops-apt-pkg">${escapeHtml(p.name)}</td><td class="ops-apt-ver">${escapeHtml(
          p.current || "—"
        )}</td><td class="ops-apt-ver">${escapeHtml(p.candidate || "—")}</td></tr>`
    )
    .join("");

  host.innerHTML =
    meta +
    `<table class="mc-table mc-table-apt" aria-label="APT packages with upgrades available"><thead><tr>
      <th class="ops-apt-sortable" scope="col" data-sort-key="name" role="columnheader" tabindex="0" aria-sort="${aptPkgSortAriaSort()}">Package${aptPkgSortArrowHtml()}</th>
      <th scope="col" class="ops-apt-th-ver">Current</th>
      <th scope="col" class="ops-apt-th-ver">Upgrades to</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function syncAptPackagesVisibility() {
  const btn = document.getElementById("apt-packages-toggle");
  const detail = document.getElementById("apt-packages-detail");
  if (!btn || !detail) return;
  const hasList = Array.isArray(lastAptPackages) && lastAptPackages.length > 0;
  if (!hasList) {
    detail.hidden = true;
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  detail.hidden = !aptPackagesExpanded;
  btn.setAttribute("aria-expanded", aptPackagesExpanded ? "true" : "false");
  btn.textContent = aptPackagesExpanded ? "Hide packages" : "Show packages";
}

function initAptPackagesToggle() {
  aptPackagesExpanded = loadAptPackagesExpanded();
  aptPkgSortDir = loadAptPkgSortDir();
  const search = document.getElementById("apt-packages-search");
  if (search && search.value === "") {
    search.value = loadAptPkgSearch();
  }
  const debouncedSaveAptSearch = debounce(() => saveAptPkgSearch(), 400);
  search?.addEventListener("input", () => {
    renderAptPackagesTable();
    debouncedSaveAptSearch();
  });
  initAptPackagesSortHeaderClicks();

  const btn = document.getElementById("apt-packages-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    setAptPackagesExpanded(!aptPackagesExpanded);
    syncAptPackagesVisibility();
  });
}

function applySnapshot(data) {
  const pill = document.getElementById("conn-pill");
  if (pill && !loadStreamPaused()) {
    pill.textContent = "live";
    pill.className = "pill pill-ok";
  }

  const os = data.os || {};
  const pretty = [os.PRETTY_NAME, os.VERSION_ID].filter(Boolean).join(" ");
  setText(
    "host-line",
    `${data.host || "—"} · ${pretty || "Linux"}`
  );

  const cpu = data.cpu || {};
  setText("cpu-value", `${cpu.percent != null ? cpu.percent.toFixed(1) : "—"}%`);
  const la = cpu.load_avg;
  setText(
    "cpu-load",
    la ? `load ${la.map((x) => x.toFixed(2)).join(" ")}` : "load —"
  );
  setBar("cpu-bar", cpu.percent || 0);
  lastSnapshotLogicalCpus = Number(cpu.count_logical) || 1;

  const mem = data.memory || {};
  setText(
    "mem-value",
    mem.percent != null ? `${mem.percent.toFixed(1)}%` : "—"
  );
  setText(
    "mem-meta",
    `${formatBytes(mem.used)} / ${formatBytes(mem.total)} · avail ${formatBytes(
      mem.available
    )}`
  );
  setBar("mem-bar", mem.percent || 0);

  const sw = data.swap || {};
  setText(
    "swap-value",
    sw.total ? `${sw.percent.toFixed(1)}%` : "—"
  );
  setText(
    "swap-meta",
    sw.total ? `${formatBytes(sw.used)} / ${formatBytes(sw.total)}` : "no swap"
  );
  setBar("swap-bar", sw.total ? sw.percent : 0);

  setText("uptime-value", formatUptime(data.uptime_sec || 0));
  setText("os-meta", pretty || "—");

  lastThermal = data.thermal ?? null;
  renderThermal(lastThermal);
  lastFans = data.fans ?? null;
  renderFans(lastFans);

  const failed = data.systemd_failed;
  const systemdEl = document.getElementById("systemd-row");
  if (systemdEl) {
    if (failed === null) {
      systemdEl.textContent =
        "Systemd failed units: could not query (no systemctl on PATH, or no D-Bus/session)";
      systemdEl.className = "ops-row";
    } else if (!failed.length) {
      systemdEl.textContent = "Systemd failed: none";
      systemdEl.className = "ops-row ops-ok";
    } else {
      systemdEl.textContent = `Systemd failed: ${failed.join(", ")}`;
      systemdEl.className = "ops-row ops-crit";
    }
  }

  const apt = data.apt_upgradable;
  const aptSummary = document.getElementById("apt-summary");
  if (aptSummary) {
    if (apt === null) {
      aptSummary.textContent = "APT upgradable: —";
      aptSummary.className = "ops-apt-summary-text";
    } else if (apt === 0) {
      aptSummary.textContent = "APT upgradable: 0";
      aptSummary.className = "ops-apt-summary-text ops-ok";
    } else {
      aptSummary.textContent = `APT upgradable: ${apt}`;
      aptSummary.className = "ops-apt-summary-text ops-warn";
    }
  }
  if (data.apt_upgradable_packages !== undefined) {
    lastAptPackages = data.apt_upgradable_packages;
  }
  renderAptPackagesTable();
  syncAptPackagesVisibility();

  renderDisks(data.disk);
  lastZfsPools = Array.isArray(data.zfs_pools) ? data.zfs_pools : [];
  renderZfsPools(lastZfsPools);
  lastNetwork = data.network ?? null;
  renderNet(lastNetwork);
  lastListeningPorts = data.listening_ports ?? null;
  renderListeningPorts(lastListeningPorts);
  lastDiskIo = data.disk_io ?? null;
  renderDiskIo(lastDiskIo);

  lastDocker = data.docker ?? null;
  renderDockerAll();

  lastProcesses = Array.isArray(data.processes) ? data.processes : [];
  renderProcsTable();
}

function tickClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const now = new Date();
  const opts = {
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  };
  if (clockFormatHour12) {
    opts.hour = "numeric";
    opts.hour12 = true;
  } else {
    opts.hour = "2-digit";
    opts.hour12 = false;
  }
  el.textContent = now.toLocaleString(undefined, opts);
}

initTheme();
initHeaderPrefs();
initClockFormatControl();
initModalWidthControl();
initContentLayoutMaxControl();
initContentPaddingControl();
initProcMemUnitControl();
initNetworkPanel();
initThermalPanel();
initSettingsDrawer();
initSettingsBackup();
initProcessDetailModal();
initDiskDetailModal();
initBlockDevDetailModal();
initZpoolDetailModal();
initNetDetailModal();
initThermalDetailModal();
initDockerDetailModal();
initModalEscapeToClose();
initPanelLayout();
initPanelVisibilityControls();
initAptPackagesToggle();
initStoragePanel();
initContainersPanel();
initProcessControls();
initUpdateIntervalControl();

tickClock();
setInterval(tickClock, 1000);

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

const PANEL_IDS = ["compute", "operations", "storage", "network", "processes"];
const PANEL_LABELS = {
  compute: "Compute",
  operations: "Operations",
  storage: "Storage",
  network: "Network",
  processes: "Top processes",
};
const PANEL_VISIBILITY_KEY = "mc-panel-visibility";
const PANEL_ORDER_KEY = "mc-panel-order";
const PANEL_COLLAPSED_KEY = "mc-panel-collapsed";

function loadPanelVisibility() {
  const d = {};
  for (const id of PANEL_IDS) d[id] = true;
  try {
    const o = JSON.parse(localStorage.getItem(PANEL_VISIBILITY_KEY) || "null");
    if (o && typeof o === "object") {
      for (const id of PANEL_IDS) {
        if (typeof o[id] === "boolean") d[id] = o[id];
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
      if (id === "processes") connectMetricsStream();
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

/** Whether the live stream should collect top processes (server skips work when false). */
function streamIncludeProcesses() {
  const section = document.querySelector('section.panel[data-panel-id="processes"]');
  if (!section) return true;
  if (section.hidden) return false;
  if (section.classList.contains("is-collapsed")) return false;
  return true;
}

/** Max processes to pull from the server on each snapshot (0 = full machine scan). */
function streamProcSampleLimit() {
  const el = document.getElementById("proc-limit");
  if (!el || el.value === "" || el.value == null) return 200;
  const n = parseInt(el.value, 10);
  if (!Number.isFinite(n) || n < 0) return 200;
  return n;
}

function connectMetricsStream() {
  if (metricsEventSource) {
    metricsEventSource.close();
    metricsEventSource = null;
  }
  if (loadStreamPaused()) {
    const pill = document.getElementById("conn-pill");
    if (pill) {
      pill.textContent = "paused";
      pill.className = "pill pill-paused";
    }
    return;
  }
  const sec = loadUpdateInterval();
  const procs = streamIncludeProcesses();
  const procLimit = streamProcSampleLimit();
  const u = `/api/stream?interval=${encodeURIComponent(String(sec))}&processes=${procs}&proc_limit=${encodeURIComponent(String(procLimit))}`;
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
  applyProcPrefsToForm();

  aptPackagesExpanded = loadAptPackagesExpanded();
  aptPkgSortDir = loadAptPkgSortDir();
  const aptSearch = document.getElementById("apt-packages-search");
  if (aptSearch) aptSearch.value = loadAptPkgSearch();

  const pauseEl = document.getElementById("stream-pause");
  if (pauseEl) pauseEl.checked = loadStreamPaused();
  const intervalSel = document.getElementById("update-interval-select");
  if (intervalSel) intervalSel.value = String(loadUpdateInterval());

  connectMetricsStream();
  renderProcsTable();
  renderDisks(lastDisks);
  renderAptPackagesTable();
  syncAptPackagesVisibility();
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

function syncCollapseButton(section) {
  const btn = section.querySelector(".panel-collapse");
  const body = section.querySelector(".panel-body");
  const titleEl = section.querySelector(".panel-head h2");
  const title = titleEl ? titleEl.textContent.trim() : "section";
  const collapsed = section.classList.contains("is-collapsed");
  if (body) body.hidden = collapsed;
  if (btn) {
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.textContent = collapsed ? "+" : "−";
    btn.setAttribute("aria-label", collapsed ? `Expand ${title}` : `Collapse ${title}`);
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
    syncCollapseButton(section);
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
  syncCollapseButton(section);
  if (id === "processes") connectMetricsStream();
}

function initPanelLayout() {
  applyPanelOrder();
  loadPanelCollapsed();

  const main = document.querySelector("main.mc-grid");
  if (!main) return;

  main.querySelectorAll("section.panel[data-panel-id]").forEach((section) => {
    const handle = section.querySelector(".panel-drag");
    const collapseBtn = section.querySelector(".panel-collapse");
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

    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => togglePanelCollapse(section));
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

function formatBps(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${formatBytes(n)}/s`.replace(" B/", " B/s").replace("/s/s", "/s");
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

function initStoragePanel() {
  loadDiskSortKeyDir();
  initDiskSortHeaderClicks();
  initDiskRowClicks();
}

const DISK_DETAIL_PRIORITY = [
  "mountpoint",
  "device",
  "fstype",
  "mount_options",
  "total",
  "used",
  "free",
  "percent",
  "inode_percent",
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

function initModalEscapeToClose() {
  if (initModalEscapeToClose.done) return;
  initModalEscapeToClose.done = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
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

function renderNet(net) {
  const wrap = document.getElementById("net-table");
  if (!wrap) return;
  const rates = (net && net.rates) || {};
  const ifs = net && net.interfaces ? Object.keys(net.interfaces) : [];
  if (!ifs.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No interfaces</p>";
    return;
  }
  const rows = ifs
    .sort()
    .map((name) => {
      const r = rates[name] || {};
      return `<tr><td>${escapeHtml(name)}</td><td>${formatBps(
        r.recv_bps
      )}</td><td>${formatBps(r.sent_bps)}</td></tr>`;
    })
    .join("");
  wrap.innerHTML = `<table class="mc-table"><thead><tr><th>Interface</th><th>↓</th><th>↑</th></tr></thead><tbody>${rows}</tbody></table>`;
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
  renderNet(data.network);

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
initProcMemUnitControl();
initSettingsDrawer();
initSettingsBackup();
initProcessDetailModal();
initDiskDetailModal();
initModalEscapeToClose();
initPanelLayout();
initPanelVisibilityControls();
initAptPackagesToggle();
initStoragePanel();
initProcessControls();
initUpdateIntervalControl();

tickClock();
setInterval(tickClock, 1000);

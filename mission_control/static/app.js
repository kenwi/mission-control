const THEMES = [
  { id: "dark", label: "Mission dark" },
  { id: "light", label: "Mission light" },
  { id: "midnight", label: "Midnight" },
  { id: "dawn", label: "Dawn" },
  { id: "ember", label: "Ember" },
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
    });
  }
  applyPanelVisibility();
}

const UPDATE_INTERVAL_KEY = "mc-update-interval";
const STREAM_INTERVAL_OPTIONS = [0.25, 0.5, 1, 2, 5, 10];

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

function connectMetricsStream() {
  if (metricsEventSource) {
    metricsEventSource.close();
    metricsEventSource = null;
  }
  const sec = loadUpdateInterval();
  const u = `/api/stream?interval=${encodeURIComponent(String(sec))}`;
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
    if (pill) {
      pill.textContent = "reconnecting…";
      pill.className = "pill pill-warn";
    }
  };
}

function initUpdateIntervalControl() {
  const sel = document.getElementById("update-interval-select");
  if (!sel) return;
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
  connectMetricsStream();
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
    if (map[id]) section.classList.add("is-collapsed");
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

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function renderDisks(disks) {
  const wrap = document.getElementById("disk-table");
  if (!wrap) return;
  if (!disks || !disks.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">No mounts</p>";
    return;
  }
  const rows = disks
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.mountpoint)}</td><td>${escapeHtml(
          d.fstype || ""
        )}</td><td class="${diskClass(
          d.percent
        )}">${d.percent.toFixed(1)}%</td><td>${formatBytes(
          d.used
        )}</td><td>${formatBytes(d.total)}</td><td>${
          d.inode_percent != null ? d.inode_percent.toFixed(1) + "% inodes" : "—"
        }</td></tr>`
    )
    .join("");
  wrap.innerHTML = `<table class="mc-table"><thead><tr><th>Mount</th><th>FS</th><th>Use</th><th>Used</th><th>Total</th><th>Inodes</th></tr></thead><tbody>${rows}</tbody></table>`;
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

let lastProcesses = [];
let lastAptPackages = null;
const APT_PACKAGES_EXPANDED_KEY = "mc-ops-apt-packages-expanded";
const APT_PKG_SEARCH_KEY = "mc-apt-pkg-search";
const APT_PKG_SORT_DIR_KEY = "mc-apt-pkg-sort-dir";
let aptPackagesExpanded = false;
/** @type {"asc"|"desc"} */
let aptPkgSortDir = "asc";
const PROC_PREFS_KEY = "mc-proc-prefs";

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
let procMemUnit = "mb";
/** @type {"percent"|"bytes"|"both"} */
let procMemDisplay = "both";

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
      cmp = a.cpu_percent - b.cpu_percent;
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
  if (!Number.isFinite(limit) || limit < 1) limit = 12;
  limit = Math.min(500, limit);

  const raw = lastProcesses || [];
  if (!raw.length) {
    wrap.innerHTML = "<p class=\"tile-meta\">—</p>";
    return;
  }

  let list = raw.map((p) => ({
    pid: p.pid,
    name: p.name,
    cpu_percent: Number(p.cpu_percent) || 0,
    memory_percent: Number(p.memory_percent) || 0,
    memory_rss: Number(p.memory_rss) || 0,
  }));

  if (q) {
    list = list.filter((p) => String(p.name || "").toLowerCase().includes(q));
  }

  list.sort(cmpProcRows);

  const totalMatching = list.length;
  const shown = list.slice(0, limit);

  const meta =
    totalMatching === 0 && q
      ? `<p class="proc-table-meta">No matches for '${escapeHtml(q)}' · ${raw.length} processes in sample</p>`
      : `<p class="proc-table-meta">Showing ${shown.length} of ${totalMatching}${q ? " matching" : ""} · ${raw.length} in sample</p>`;

  if (!shown.length) {
    wrap.innerHTML =
      meta +
      (totalMatching === 0 && q
        ? ""
        : "<p class=\"tile-meta\">—</p>");
    return;
  }

  const memColW = procMemDisplay === "percent" ? "4.25rem" : "8.5rem";

  const rows = shown
    .map(
      (p) =>
        `<tr><td class="proc-td-pid">${fmtProcPid(p.pid)}</td><td class="proc-td-name" title="${escapeHtml(p.name)}">${escapeHtml(
          p.name
        )}</td><td class="proc-td-metric">${fmtProcPct(p.cpu_percent)}</td><td class="proc-td-metric proc-td-mem">${fmtProcMemCell(
          p
        )}</td></tr>`
    )
    .join("");

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
      <th class="proc-th proc-th-metric proc-sortable" scope="col" data-sort-key="cpu" role="columnheader" tabindex="0" aria-sort="${procSortAriaSort("cpu")}">CPU${procSortArrowHtml("cpu")}</th>
      <th class="proc-th proc-th-metric proc-sortable" scope="col" data-sort-key="mem" role="columnheader" tabindex="0" aria-sort="${procSortAriaSort("mem")}">MEM${procSortArrowHtml("mem")}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function initProcessControls() {
  applyProcPrefsToForm();
  loadProcSortKeyDir();
  initProcSortHeaderClicks();
  const search = document.getElementById("proc-search");
  const limit = document.getElementById("proc-limit");
  const debouncedSaveSearch = debounce(() => saveProcPrefs(), 400);
  search?.addEventListener("input", () => {
    renderProcsTable();
    debouncedSaveSearch();
  });
  limit?.addEventListener("change", () => {
    saveProcPrefs();
    renderProcsTable();
  });
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
  if (pill) {
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
initClockFormatControl();
initProcMemUnitControl();
initSettingsDrawer();
initPanelLayout();
initPanelVisibilityControls();
initAptPackagesToggle();
initProcessControls();
initUpdateIntervalControl();

tickClock();
setInterval(tickClock, 1000);

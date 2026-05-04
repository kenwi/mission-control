# Mission Control

Mission Control is a small, self-contained **FastAPI** app that serves a **local web dashboard** for your Linux machine. It bundles the UI (HTML/CSS/JS) and API in one process, so no separate nginx or reverse proxy is required. It targets everyday workstations (including Mint-style setups).

**In the UI you get:** Compute tiles (CPU, memory, swap, uptime); **Thermal** sensors and fans; **Operations** (systemd failed units, APT upgradable packages); **Storage** (mounts, optional ZFS pools, disk I/O from `/proc/diskstats`); **Network** interfaces and **listening ports**; and a **Top processes** table. Metrics work **without root** for the core snapshot. Some data (all sockets, SMART via `smartctl`, full process names on listening ports) improves when the process has broader permissions.

Optional panels use `systemd` and `apt` when they are on your `PATH`. ZFS summaries appear when `zpool` works.

## Requirements

- Python **3.12+** (or the version you use for the project venv)
- Linux (metrics are Linux-oriented)

## Install

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
```

## Run

```bash
./run.sh
```

Or:

```bash
.venv/bin/python -m mission_control
```

Defaults: **http://127.0.0.1:8765**

Bind elsewhere:

```bash
.venv/bin/python -m mission_control --host 0.0.0.0 --port 8765
```

## Usage

Open the app in a browser. The UI updates live over **Server-Sent Events** (`/api/stream`), unless you **pause live updates** in the options panel.

**Main sections** can be **reordered** by dragging the **≡** handle on each header. **Collapse or expand** a section by **clicking its title** (the uppercase heading), not a separate icon.

Many blocks use **subsections** (for example **Sensors** / **Fans** under Thermal, **Mounts** / **ZFS** / **Disk I/O** under Storage, **Interfaces** / **Listening ports** under Network). **Click the subsection title** to show or hide that block; preferences are remembered in the browser.

Click the **settings** control (gear) to open **Options**:

- **Header title**: Custom label and optional **show/hide** for the title line (host line and status stay visible).
- **Theme** and **clock** (12h / 24h).
- **Process memory column**: Percent only, RSS in MB or GB, or both; MB/GB applies when bytes are shown.
- **Process CPU column**: **All CPUs** (default, same scale as the Compute tile) or **per logical CPU** (psutil-style; can exceed **100%**). Row tooltips show the other scale for comparison.
- **Visible panels**: Toggle sections.
- **Update interval**: Seconds between SSE snapshots; the UI uses fixed steps **0.25 s through 30 s** (same bounds as `/api/stream`). Values outside that range are clamped; values between steps snap to the nearest step.
- **Pause live updates**: Stops the stream (status shows **paused**); unpause reconnects with the current interval.
- **Layout / dialogs**: Modal width, content width, and padding presets where offered.
- **Settings backup**: **Export** all stored options as JSON or **import** a file (including a flat `mc-*` key map).

Preferences live in the browser’s **localStorage**. A full export includes keys for theme, panel order and visibility, collapsed state, table sort orders, listening-port filters, and similar UI state.

**Slow metrics** (systemd failed units, APT upgrade count and package list) are refreshed at most about **every 30 seconds** so routine polling stays light; the UI keeps the last values between those runs.

### Thermal

- **Sensors**: Sortable table; **click a row** (when a detail key exists) for a modal with sysfs / zone detail from `/api/thermal/detail`.
- **Fans**: Sortable **Fan** and **RPM** columns; **click a row** for hwmon fan attribute detail from `/api/fan/detail`.

### Storage

- **Mounts**: Sortable; **click a row** for mount usage and `statvfs` detail (`/api/mount`).
- **ZFS pools**: Shown when pools are detected; sortable summary table and **row** detail (`/api/zpool/{name}`).
- **Disk I/O**: Per-device rates and cumulative counters from **diskstats**; **click a row** for block device sysfs and optional **SMART** (`smartctl` when available, `/api/block/{dev_name}`). The live stream can omit disk I/O work with the `disk_io=false` query parameter (see API below).

### Network

- **Interfaces**: Sortable; cumulative RX/TX and live rates; **click a row** for interface detail (`/api/net/interface/{ifname}`).
- **Listening ports**: TCP listeners and bound UDP sockets from each snapshot. **Search** matches **local IP**, **port**, and **process** (whitespace-separated tokens, each must appear somewhere in those fields). **Protocol** and **Family** dropdowns narrow the list. Columns are sortable; filters and sort preferences can be exported with settings.

### Top processes

Filter by name, choose how many rows to show (**10–200** or **All** for the full sampled list from the server), and sort by column header (**PID**, **Name**, **CPU**, **MEM**). **CPU** defaults to each process’s share of **all logical CPUs** (aligned with the Compute tile). Options can switch the column to **per logical CPU** (where **100%** is one core and multi-core work can exceed **100%**); the cell tooltip always shows the complementary value. Memory sorting follows the configured display (percent vs RSS). Optionally show a **footer row** with the **sum of RSS** for the processes currently listed (toggle in Options). **Click a row** (or focus it and press **Enter** or **Space**) to open a dialog with extended process information (fetched on demand from `/api/process/{pid}`).

### Operations

When upgrades exist, expand the APT summary to list packages with **installed and candidate versions**, **search** by name, and **sort** by the **Package** column.

## API (for scripts or debugging)

Snapshot JSON (from `/api/metrics` or SSE `data:` lines) includes fields such as `cpu`, `memory`, `swap`, `disk`, `zfs_pools`, `network`, `listening_ports`, `disk_io`, `thermal`, `fans`, `processes`, `systemd_failed`, `apt_upgradable`, and timestamps. `disk_io` may be `null` when collection was skipped.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard HTML |
| `GET` | `/assets/…` | Static assets |
| `GET` | `/api/health` | `{"status":"ok"}` |
| `GET` | `/api/metrics` | Single JSON snapshot; query: `processes` (bool), `proc_limit` (0 = all in sample), `disk_io` (bool, default true; false skips diskstats / `disk_io` in payload) |
| `GET` | `/api/stream` | SSE stream; query: `interval` (**0.25–30** s), `processes` (bool), `disk_io` (bool), `proc_limit` (default **200**; **0** = full process list each tick) |
| `GET` | `/api/thermal/detail?key=…` | Sysfs / thermal zone detail (`zone:thermal_zoneN` or `hwmon:hwmonN:tempM`) |
| `GET` | `/api/fan/detail?key=…` | Hwmon fan channel sysfs (`hwmon:hwmonN:fanM`) |
| `GET` | `/api/net/interface/{ifname}` | Interface addresses, stats, sysfs hints, rates when known |
| `GET` | `/api/mount?mountpoint=…` | Mount usage + `statvfs`; URL-encoded path |
| `GET` | `/api/block/{dev_name}` | Block device sysfs + diskstats snapshot + `smartctl` when available |
| `GET` | `/api/zpool/{pool_name}` | ZFS pool status and `zpool get` style detail |
| `GET` | `/api/process/{pid}` | Live process detail JSON; **404** if the process is gone |

## Project layout

- `mission_control/main.py`: FastAPI app, routes, static mount
- `mission_control/metrics.py`: Snapshot collection (`psutil`, optional `systemctl` / `apt` / `zpool` / `zfs` / `findmnt`, diskstats, hwmon, listening sockets)
- `mission_control/static/`: Browser UI
- `pyproject.toml`: Package metadata and dependencies
- `run.sh`: Run from the project venv

## License

[MIT](LICENSE)

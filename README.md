# Mission Control

Mission Control is a small, self-contained **FastAPI** app that serves a **local web dashboard** for your Linux machine. It bundles the UI (HTML/CSS/JS) and API in one process, so no separate nginx or reverse proxy is required. It targets everyday workstations (including Mint-style setups).

**In the UI you get:** **Compute** tiles (CPU, memory, swap, uptime); **Thermal** sensors and fans; **Operations** (systemd failed units, APT upgradable packages); **Storage** (mounts, optional ZFS pools, disk I/O from `/proc/diskstats`); **Network** interfaces and **listening ports**; **Containers** (Docker containers, images, and volumes in collapsible sub-panels); and a **Top processes** table. Metrics work **without root** for the core snapshot. Some data (all sockets, SMART via `smartctl`, full process names on listening ports) improves when the process has broader permissions.

Optional panels use `systemd` and `apt` when they are on your `PATH`. ZFS summaries appear when `zpool` works. Docker lists require the `docker` CLI on **PATH**.

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

Open the app in a browser. The UI updates live over **Server-Sent Events** (`/api/stream`), unless you **pause live updates** in the options panel. The browser **closes the EventSource** when you leave the page or hide the tab, then **reconnects** when the tab is visible again (unless updates are paused).

**Main sections** can be **reordered** by dragging the **≡** handle on each header. **Collapse or expand** a section by **clicking its title** (the uppercase heading), not a separate icon.

Many blocks use **subsections** (for example **Sensors** / **Fans** under Thermal, **Mounts** / **ZFS** / **Disk I/O** under Storage, **Interfaces** / **Listening ports** under Network, and three blocks under **Containers**). **Click the subsection title** to show or hide that block; preferences are remembered in the browser.

**Workload skipping:** When a main panel is **hidden** (Options → Visible panels) or **collapsed** (title click), or when a **subsection** is collapsed, the live stream asks the server **not** to collect metrics for that part of the snapshot (fewer syscalls, no Docker CLI, no diskstats, etc.). Details fetched when you **open a row modal** (mount, process, Docker inspect, and so on) still call their endpoints on demand.

Click the **settings** control (gear) to open **Options**:

- **Header title**: Custom label and optional **show/hide** for the title line (host line and status stay visible).
- **Theme** and **clock** (12h / 24h).
- **Process memory column**: Percent only, RSS in MB or GB, or both; MB/GB applies when bytes are shown.
- **Process CPU column**:
  - **All CPUs** (default): each process’s share of **all logical CPUs**, aligned with the Compute tile.
  - **GNOME System Monitor-style (smoothed)**: same scale as above, with **EWMA smoothing** so short spikes settle similarly to a slower refresh.
  - **Per logical CPU**: psutil-style **(100% = one core; multi-threaded work can exceed 100%)**. Row tooltips always include the complementary scale where helpful.
- **CPU layout (for process CPU %)**: Detected **sockets**, **cores per socket**, and **threads per core** (from Linux **sysfs** when available, else **psutil**). Defaults populate the three dropdowns; you can override them manually. **Detect / reset to hardware** re-fetches detection and saves it. The product **sockets × cores × threads** is sent to the server as `proc_cpu_divisor` so process **CPU %** and the process detail dialog stay consistent. Stored in **localStorage** and included in **settings export**.
- **Visible panels**: Toggle sections.
- **Update interval**: Seconds between SSE snapshots; the UI uses fixed steps **0.25 s through 30 s** (same bounds as `/api/stream`). Values outside that range are clamped; values between steps snap to the nearest step.
- **Pause live updates**: Stops the stream (status shows **paused**); unpause reconnects with the current interval.
- **Layout / dialogs**: Modal width, content width, and padding presets where offered.
- **Settings backup**: **Export** all stored options as JSON or **import** a file (including a flat `mc-*` key map).

Preferences live in the browser’s **localStorage**. A full export includes keys for theme, panel order and visibility, collapsed state, table sort orders, listening-port filters, Docker subsection collapse, CPU layout, and similar UI state.

**Slow metrics** (systemd failed units, APT upgrade count and package list) are refreshed at most about **every 30 seconds** when the **Operations** panel is included in the stream; the UI keeps the last values between those runs.

### Thermal

- **Sensors**: Sortable table; **click a row** (when a detail key exists) for a modal with sysfs / zone detail from `/api/thermal/detail`.
- **Fans**: Sortable **Fan** and **RPM** columns; **click a row** for hwmon fan attribute detail from `/api/fan/detail`.

### Storage

- **Mounts**: Sortable; **click a row** for mount usage and `statvfs` detail (`/api/mount`).
- **ZFS pools**: Shown when pools are detected; sortable summary table and **row** detail (`/api/zpool/{name}`).
- **Disk I/O**: Per-device rates and cumulative counters from **diskstats**; **click a row** for block device sysfs and optional **SMART** (`smartctl` when available, `/api/block/{dev_name}`). The stream omits disk I/O when the Storage panel is hidden/collapsed or the Disk I/O subsection is collapsed.

### Network

- **Interfaces**: Sortable; cumulative RX/TX and live rates; **click a row** for interface detail (`/api/net/interface/{ifname}`).
- **Listening ports**: TCP listeners and bound UDP sockets from each snapshot. **Search** matches **local IP**, **port**, and **process** (whitespace-separated tokens, each must appear somewhere in those fields). **Protocol** and **Family** dropdowns narrow the list. Columns are sortable; filters and sort preferences can be exported with settings.

### Containers (Docker)

Three sortable tables (**Containers**, **Images**, **Volumes**) with key columns from `docker` CLI output. **Click a row** (or focus and press **Enter** / **Space**) to open a modal with **inspect-style JSON** (`/api/docker/container?id=…`, `/api/docker/image?ref=…`, `/api/docker/volume?name=…`). The live stream skips Docker collection when the Containers panel is hidden/collapsed; individual subsections can be collapsed separately.

### Top processes

**Search** filters by process **name** (substring, case-insensitive). **While the search box is non-empty**, the browser requests a **full process sample** (`proc_limit=0` on the stream) so matches are not limited to the top *N* by CPU/memory heuristic; the **Show** dropdown still limits **how many rows** are displayed after filtering and sorting.

Choose how many rows to show (**10–200** or **All** for the filtered list), and sort by column header (**PID**, **Name**, **CPU**, **MEM**). **CPU** scaling follows the Process CPU option above. Memory sorting follows the configured display (percent vs RSS). Optionally show a **footer row** with the **sum of RSS** for the processes currently listed (toggle in Options). **Click a row** (or focus it and press **Enter** or **Space**) to open a dialog with extended process information (fetched on demand from `/api/process/{pid}`; **`proc_cpu_divisor`** is passed when a CPU layout is configured so **CPU %** matches the table).

### Operations

When upgrades exist, expand the APT summary to list packages with **installed and candidate versions**, **search** by name, and **sort** by the **Package** column.

## API (for scripts or debugging)

Snapshot JSON (from `/api/metrics` or SSE `data:` lines) includes fields such as `cpu`, `memory`, `swap`, `disk`, `zfs_pools`, `network`, `listening_ports`, `disk_io`, `thermal`, `fans`, `processes`, `docker`, `systemd_failed`, `apt_upgradable`, and timestamps. Omitted sections are returned as **`null`** (or `processes` as `[]`) when collection was skipped.

### Query parameters: `/api/metrics` and `/api/stream`

Both endpoints accept the same **boolean** query flags (all default **`true`**). Set a flag to **`false`** to skip work for that part of the snapshot:

`compute`, `network`, `listening_ports`, `thermal`, `fans`, `operations`, `mounts`, `zfs`, `disk_io`, `processes`, `docker_containers`, `docker_images`, `docker_volumes`.

Other parameters:

| Parameter | Applies to | Description |
|-----------|------------|-------------|
| `interval` | Stream only | Seconds between snapshots (**0.25–30**). |
| `proc_limit` | Both | Max processes ranked per tick (**0** = scan all). The UI uses **0** automatically while the process **search** box is non-empty. |
| `proc_cpu_divisor` | Both | Optional integer **1–4096**: divisor for “all CPUs” process CPU **%** (`sockets × cores × threads`). Omit to use the OS logical CPU count. |

Internally, `/api/metrics` may refresh systemd/APT on about a **30 s** cadence; the stream reuses the same cached values between those refreshes when Operations is enabled.

### Route table

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard HTML |
| `GET` | `/assets/…` | Static assets |
| `GET` | `/api/health` | `{"status":"ok"}` |
| `GET` | `/api/cpu-topology` | Detected **sockets**, **cores_per_socket**, **threads_per_core**, **logical** CPUs, **physical_total**, **source** (`sysfs` / `psutil`), **product_matches_logical** |
| `GET` | `/api/metrics` | Single JSON snapshot; see query parameters above |
| `GET` | `/api/stream` | SSE stream; see query parameters above |
| `GET` | `/api/thermal/detail?key=…` | Sysfs / thermal zone detail (`zone:thermal_zoneN` or `hwmon:hwmonN:tempM`) |
| `GET` | `/api/fan/detail?key=…` | Hwmon fan channel sysfs (`hwmon:hwmonN:fanM`) |
| `GET` | `/api/net/interface/{ifname}` | Interface addresses, stats, sysfs hints, rates when known |
| `GET` | `/api/mount?mountpoint=…` | Mount usage + `statvfs`; URL-encoded path |
| `GET` | `/api/block/{dev_name}` | Block device sysfs + diskstats snapshot + `smartctl` when available |
| `GET` | `/api/zpool/{pool_name}` | ZFS pool status and `zpool get` style detail |
| `GET` | `/api/docker/container?id=…` | `docker container inspect` JSON |
| `GET` | `/api/docker/image?ref=…` | `docker image inspect` JSON |
| `GET` | `/api/docker/volume?name=…` | `docker volume inspect` JSON |
| `GET` | `/api/process/{pid}` | Live process detail JSON; optional `proc_cpu_divisor`; **404** if the process is gone |

## Project layout

- `mission_control/main.py`: FastAPI app, routes, static mount
- `mission_control/metrics.py`: Snapshot collection (`psutil`, optional `systemctl` / `apt` / `zpool` / `zfs` / `findmnt`, diskstats, hwmon, listening sockets, Docker CLI, CPU topology)
- `mission_control/static/`: Browser UI
- `pyproject.toml`: Package metadata and dependencies
- `run.sh`: Run from the project venv

## License

[MIT](LICENSE)

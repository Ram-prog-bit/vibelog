# VibeLog

A flight recorder for your coding agents. Local only — no cloud, no telemetry; data lives in `~/.vibelog`.

## Quickstart

```bash
npm install -g vibelogapp

vibelog start           # record real Claude Code sessions + dashboard on http://localhost:3232
vibelog start --mock    # demo mode: 2-3 simulated agents, tokens ticking, sessions rotating
```

The published package ships a prebuilt dashboard; from a repo clone (`npm install -g .`) the first run builds it once (~a minute), then serves it with `next start`.

Flags: `--port=N` (default 3232), `--no-dash` (collector only).

In the dashboard: `Cmd/Ctrl+K` searches every recorded session (titles, prompts, file paths, bash commands, outputs), and the Export button on the Sessions page downloads CSV / JSON / Markdown — generated in your browser, no server involved.

## Team mode (LAN)

One dashboard for every machine on your network. One person hosts, everyone else connects:

```bash
vibelog start --host          # host: dashboard open to the LAN, prints the address to share
vibelog connect 192.168.1.20  # everyone else: sends this machine's sessions to the host
```

Sessions show up on the host labeled with each machine's hostname, and Mission control groups them per machine. Connected machines POST straight to the host's `/api/ingest` — still no cloud, no accounts.

**Security, stated plainly:** team mode has no auth in v1. While `--host` runs, anyone who can reach that port on your network can read every recorded session — prompts and outputs included — and post sessions of their own. Trusted networks only; never port-forward it to the internet. Without `--host` the dashboard binds to `127.0.0.1`.

## How it works

```
vibelog start ──► collector ──► ~/.vibelog/state.json ──► /api/stream (SSE) ──► dashboard
```

- **Real mode** tails the JSONL transcripts Claude Code already writes under `~/.claude/projects` — sessions, models, token counts, tool calls, costs at list price. A session with no writes for 2 minutes counts as finished.
- **Mock mode** simulates a busy machine: live sessions accumulate events and tokens each tick, finish after a few minutes, and queued sessions take their slot. Indistinguishable from real data to the dashboard.
- The dashboard (`src/app`) falls back to built-in demo data when no CLI is running, so a plain deploy (Vercel) still shows a full UI.
- The SSE route sends each browser tab one full snapshot on connect, then only the sessions that changed each tick (`snapshot`/`diff` frames) — a live tick is KBs on the wire, not the whole multi-MB state file.

CLI source: [bin/vibelog.mjs](bin/vibelog.mjs) — plain Node, zero dependencies. SSE route: [src/app/api/stream/route.ts](src/app/api/stream/route.ts). Client live layer: [src/lib/live.tsx](src/lib/live.tsx).

## Development

```bash
npm run dev                          # dashboard with hot reload (port 3000)
node bin/vibelog.mjs start --mock --no-dash   # feed it mock data
```

`VIBELOG_DIR` overrides `~/.vibelog` (both CLI and dashboard) — useful for tests.

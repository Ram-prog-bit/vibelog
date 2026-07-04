# VibeLog

A flight recorder for your coding agents. Local only — no cloud, no telemetry; data lives in `~/.vibelog`.

## Quickstart

```bash
npm install -g .        # from this repo (until published as `vibelog`)

vibelog start           # record real Claude Code sessions + dashboard on http://localhost:3232
vibelog start --mock    # demo mode: 2-3 simulated agents, tokens ticking, sessions rotating
```

First run builds the dashboard once (~a minute), then serves it with `next start`.

Flags: `--port=N` (default 3232), `--no-dash` (collector only).

## How it works

```
vibelog start ──► collector ──► ~/.vibelog/state.json ──► /api/stream (SSE) ──► dashboard
```

- **Real mode** tails the JSONL transcripts Claude Code already writes under `~/.claude/projects` — sessions, models, token counts, tool calls, costs at list price. A session with no writes for 2 minutes counts as finished.
- **Mock mode** simulates a busy machine: live sessions accumulate events and tokens each tick, finish after a few minutes, and queued sessions take their slot. Indistinguishable from real data to the dashboard.
- The dashboard (`src/app`) falls back to built-in demo data when no CLI is running, so a plain deploy (Vercel) still shows a full UI.

CLI source: [bin/vibelog.mjs](bin/vibelog.mjs) — plain Node, zero dependencies. SSE route: [src/app/api/stream/route.ts](src/app/api/stream/route.ts). Client live layer: [src/lib/live.tsx](src/lib/live.tsx).

## Development

```bash
npm run dev                          # dashboard with hot reload (port 3000)
node bin/vibelog.mjs start --mock --no-dash   # feed it mock data
```

`VIBELOG_DIR` overrides `~/.vibelog` (both CLI and dashboard) — useful for tests.

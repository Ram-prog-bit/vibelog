import { promises as fs } from "fs";
import os from "os";
import path from "path";

// Team-mode ingest. Machines running `vibelog connect <host-ip>` POST
// { machine, sessions, totalSessions } here every collector tick; each feed is
// written to ~/.vibelog/remote/<machine>.json, which the host's collector
// merges into state.json — so remote sessions ride the same pipeline as local
// ones.
//
// Security: deliberately no auth in v1. This route is only reachable from the
// LAN when the host runs `vibelog start --host` (otherwise the dashboard binds
// 127.0.0.1). Anyone on that LAN can post sessions and read the dashboard —
// use on trusted networks only, never port-forwarded to the internet.

export const dynamic = "force-dynamic";

const REMOTE_DIR = path.join(
  process.env.VIBELOG_DIR || path.join(os.homedir(), ".vibelog"),
  "remote"
);

export async function POST(req: Request) {
  let body: { machine?: unknown; sessions?: unknown; totalSessions?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const machine = String(body.machine ?? "").trim();
  if (!machine || !Array.isArray(body.sessions))
    return Response.json({ error: "need { machine, sessions: [] }" }, { status: 400 });

  // the machine name becomes a filename — strip anything path-like
  const safe = machine.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_").slice(0, 64);
  await fs.mkdir(REMOTE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(REMOTE_DIR, safe + ".json"),
    JSON.stringify({
      machine,
      sessions: body.sessions,
      totalSessions: Number(body.totalSessions) || body.sessions.length,
    })
  );
  return Response.json({ ok: true, sessions: body.sessions.length });
}

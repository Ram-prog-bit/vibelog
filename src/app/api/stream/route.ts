import { promises as fs } from "fs";
import os from "os";
import path from "path";

// SSE stream of ~/.vibelog/state.json, written by the vibelog CLI.
//
// Wire protocol (src/lib/live.tsx is the only consumer):
//   snapshot  full state, sent once when a client connects (and again if the
//             state file appears after the client connected)
//   diff      { ...meta, order, changed, removed } — only the sessions whose
//             content changed since the previous frame, plus the id order to
//             rebuild the list. A live tick touches 1–2 sessions, so this is
//             KBs where the snapshot is MBs.
//   hb        every poll, state.json's mtime (0 if absent). The CLI touches
//             the file each tick, so a fresh mtime means it is actually running.
//
// One module-level poller serves every connection: one stat/read/parse/diff
// per tick regardless of tab count, and every tab receives the same frames.

export const dynamic = "force-dynamic";

const STATE = path.join(process.env.VIBELOG_DIR || path.join(os.homedir(), ".vibelog"), "state.json");

interface SessionLike {
  id: string;
  [k: string]: unknown;
}
interface StateLike {
  now: number;
  source: string;
  sessions: SessionLike[];
  totalSessions?: number;
  maxSessions?: number;
  project?: unknown;
}

interface Sub {
  send: (event: string, data: string) => void;
  hasBase: boolean;
}

const subs = new Set<Sub>();
let timer: ReturnType<typeof setInterval> | undefined;
let lastMtime = 0;
let lastText = "";
let snapshotText = ""; // last good full state, verbatim from disk
let perSession = new Map<string, string>(); // id -> serialized session, for diffing

async function poll() {
  let mtime = 0;
  let diffText = "";
  try {
    const st = await fs.stat(STATE);
    mtime = st.mtimeMs;
    if (st.mtimeMs !== lastMtime) {
      lastMtime = st.mtimeMs;
      const text = await fs.readFile(STATE, "utf8");
      // the heartbeat touch bumps mtime without changing content — skip the
      // parse and the diff entirely when the bytes are identical
      if (text !== lastText) {
        const state = JSON.parse(text) as StateLike; // torn write throws -> retry next tick
        const next = new Map<string, string>();
        for (const s of state.sessions ?? []) next.set(s.id, JSON.stringify(s));
        if (snapshotText) {
          const changed = (state.sessions ?? []).filter(
            (s) => perSession.get(s.id) !== next.get(s.id)
          );
          const removed = [...perSession.keys()].filter((id) => !next.has(id));
          diffText = JSON.stringify({
            now: state.now,
            source: state.source,
            totalSessions: state.totalSessions,
            maxSessions: state.maxSessions,
            project: state.project,
            order: (state.sessions ?? []).map((s) => s.id),
            changed,
            removed,
          });
        }
        lastText = text;
        snapshotText = text;
        perSession = next;
      }
    }
  } catch {
    // no state file yet (hb: 0 tells the client) or a half-written one
  }
  for (const sub of subs) {
    if (!sub.hasBase && snapshotText) {
      sub.hasBase = true;
      sub.send("snapshot", snapshotText.replace(/\n/g, " "));
    } else if (diffText && sub.hasBase) {
      sub.send("diff", diffText.replace(/\n/g, " "));
    }
    sub.send("hb", String(mtime));
  }
}

function ensurePolling() {
  // ponytail: 1 Hz polling, not fs.watch — watch is unreliable on Windows
  if (!timer) {
    timer = setInterval(poll, 1000);
    poll(); // first connection gets its snapshot now, not in a second
  }
}

export async function GET(req: Request) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sub: Sub = {
        hasBase: false,
        send(event, data) {
          try {
            controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
          } catch {
            subs.delete(sub); // stream already closed
          }
        },
      };
      // a client that connects while state exists gets its snapshot immediately
      // instead of waiting up to a second for the next poll
      if (snapshotText) {
        sub.hasBase = true;
        sub.send("snapshot", snapshotText.replace(/\n/g, " "));
        sub.send("hb", String(lastMtime));
      }
      subs.add(sub);
      ensurePolling();
      req.signal.addEventListener("abort", () => {
        subs.delete(sub);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      // per-connection cleanup happens on abort; the shared poller keeps
      // running — it is one stat() a second and serves the next connection
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

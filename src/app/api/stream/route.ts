import { promises as fs } from "fs";
import os from "os";
import path from "path";

// SSE stream of ~/.vibelog/state.json, written by the vibelog CLI.
// `message` frames carry the whole state whenever its content changes; an
// `hb` frame every poll carries the file's mtime (0 if absent) — the CLI
// touches the file each tick, so a fresh mtime means it is actually running.

export const dynamic = "force-dynamic";

const STATE = path.join(process.env.VIBELOG_DIR || path.join(os.homedir(), ".vibelog"), "state.json");

export async function GET(req: Request) {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let lastMtime = 0;
      let lastText = "";
      const push = async () => {
        let mtime = 0;
        try {
          const st = await fs.stat(STATE);
          mtime = st.mtimeMs;
          if (st.mtimeMs !== lastMtime) {
            const text = await fs.readFile(STATE, "utf8");
            JSON.parse(text); // skip half-written files; the next tick retries
            lastMtime = st.mtimeMs;
            if (text !== lastText) {
              lastText = text;
              controller.enqueue(enc.encode(`data: ${text.replace(/\n/g, " ")}\n\n`));
            }
          }
        } catch {
          // no state file yet — hb: 0 below tells the client no CLI is running
        }
        try {
          controller.enqueue(enc.encode(`event: hb\ndata: ${mtime}\n\n`));
        } catch {} // stream already closed
      };
      push();
      // ponytail: 1 Hz polling, not fs.watch — watch is unreliable on Windows
      timer = setInterval(push, 1000);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
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

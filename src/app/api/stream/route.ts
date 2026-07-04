import { promises as fs } from "fs";
import os from "os";
import path from "path";

// SSE stream of ~/.vibelog/state.json, written by the vibelog CLI.
// Pushes the whole state whenever the file's mtime changes.

export const dynamic = "force-dynamic";

const STATE = path.join(process.env.VIBELOG_DIR || path.join(os.homedir(), ".vibelog"), "state.json");

export async function GET(req: Request) {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let lastMtime = 0;
      const push = async () => {
        try {
          const st = await fs.stat(STATE);
          if (st.mtimeMs === lastMtime) return;
          const text = await fs.readFile(STATE, "utf8");
          JSON.parse(text); // skip half-written files; the next tick retries
          lastMtime = st.mtimeMs;
          controller.enqueue(enc.encode(`data: ${text.replace(/\n/g, " ")}\n\n`));
        } catch {
          // no CLI running / no state yet — stay silent, client keeps its fallback
        }
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

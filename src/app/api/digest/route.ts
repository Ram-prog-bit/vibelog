import { promises as fs } from "fs";
import os from "os";
import path from "path";

// Serves the newest weekly digest from ~/.vibelog/digests (the CLI writes one
// each Monday). ?raw=1 returns the markdown file itself, as a download.

export const dynamic = "force-dynamic";

const DIGESTS = path.join(
  process.env.VIBELOG_DIR || path.join(os.homedir(), ".vibelog"),
  "digests"
);

export async function GET(req: Request) {
  let files: string[] = [];
  try {
    files = (await fs.readdir(DIGESTS)).filter((f) => /^\d{4}-W\d{2}\.md$/.test(f)).sort();
  } catch {
    // no digests dir yet
  }
  const name = files[files.length - 1];
  if (!name) return Response.json({ error: "no digest yet" }, { status: 404 });
  const markdown = await fs.readFile(path.join(DIGESTS, name), "utf8");
  if (new URL(req.url).searchParams.get("raw"))
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  return Response.json({ name, markdown });
}

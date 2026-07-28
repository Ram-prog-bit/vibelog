import { promises as fs } from "fs";
import os from "os";
import path from "path";

// "Delete all recordings" — removes state.json and every remote/*.json feed,
// then stamps `deletedBefore` into config.json so a running collector does not
// simply re-derive the same sessions from the transcripts on its next tick.
// Local-only destructive action; there is no cloud copy to restore from.

export const dynamic = "force-dynamic";

const DIR = process.env.VIBELOG_DIR || path.join(os.homedir(), ".vibelog");

export async function DELETE() {
  await fs.rm(path.join(DIR, "state.json"), { force: true });
  try {
    const remote = path.join(DIR, "remote");
    for (const f of await fs.readdir(remote))
      if (f.endsWith(".json")) await fs.rm(path.join(remote, f), { force: true });
  } catch {
    // no remote/ dir — nothing to delete
  }
  let cfg: Record<string, unknown> = {};
  try {
    cfg = JSON.parse(await fs.readFile(path.join(DIR, "config.json"), "utf8"));
  } catch {}
  cfg.deletedBefore = Date.now();
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, "config.json"), JSON.stringify(cfg, null, 2) + "\n");
  return Response.json({ ok: true });
}

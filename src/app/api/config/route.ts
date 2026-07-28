import { promises as fs } from "fs";
import os from "os";
import path from "path";
import DEFAULTS from "../../../../config.defaults.json";

// ~/.vibelog/config.json — the single settings store, shared with the CLI
// (bin/vibelog.mjs reads it every collector tick). GET returns the saved file
// merged over config.defaults.json; POST merges a partial in and writes it back.
// Unknown keys and wrong-typed values are dropped, so a bad client can't wedge
// the collector.

export const dynamic = "force-dynamic";

const DIR = process.env.VIBELOG_DIR || path.join(os.homedir(), ".vibelog");
const FILE = path.join(DIR, "config.json");

type Config = typeof DEFAULTS;

async function read(): Promise<Config> {
  try {
    return { ...DEFAULTS, ...JSON.parse(await fs.readFile(FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function GET() {
  return Response.json(await read());
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const next = (await read()) as Record<string, unknown>;
  const defaults = DEFAULTS as Record<string, unknown>;
  for (const [k, v] of Object.entries(body))
    if (k in defaults && typeof v === typeof defaults[k]) next[k] = v;
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2) + "\n");
  return Response.json(next);
}

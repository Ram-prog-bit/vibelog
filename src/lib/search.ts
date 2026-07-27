import type { Session } from "./data";

// Full-text search over sessions: titles, prompt text, tool-call labels (file
// paths, bash commands), output text, model / branch / project names.
//
// No index structure at all — each session flattens once into a text blob and
// queries are a case-insensitive substring scan with indexOf. 500 sessions is
// a few MB of text; V8 scans that in single-digit milliseconds, well under the
// 50ms budget. The blob cache is keyed on object identity: SSE diff frames
// replace only the sessions that changed, so unchanged sessions never
// re-flatten as new frames arrive.
// ponytail: substring scan, not an inverted index — revisit past ~5k sessions.

const blobs = new WeakMap<Session, { text: string; lower: string }>();

function blobOf(s: Session) {
  let b = blobs.get(s);
  if (!b) {
    const parts = [
      s.title,
      s.id,
      s.agent,
      s.model,
      s.gitBranch,
      s.gitRepo ?? "",
      s.projectName ?? "",
      s.machine ?? "",
      ...s.tags,
    ];
    for (const e of s.events) {
      parts.push(e.label);
      if (e.detail) parts.push(e.detail);
    }
    const text = parts.join("\n");
    b = { text, lower: text.toLowerCase() };
    blobs.set(s, b);
  }
  return b;
}

export function sessionMatches(s: Session, query: string) {
  const q = query.trim().toLowerCase();
  return !q || blobOf(s).lower.includes(q);
}

export interface SearchHit {
  session: Session;
  /** text around the first match; render `match` highlighted */
  before: string;
  match: string;
  after: string;
}

const oneLine = (t: string) => t.replace(/\s+/g, " ");

export function searchSessions(sessions: Session[], query: string, limit = 20): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const s of sessions) {
    const { text, lower } = blobOf(s);
    const i = lower.indexOf(q);
    if (i === -1) continue;
    const from = Math.max(0, i - 48);
    hits.push({
      session: s,
      before: (from > 0 ? "…" : "") + oneLine(text.slice(from, i)),
      match: text.slice(i, i + q.length),
      after: oneLine(text.slice(i + q.length, i + q.length + 90)),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

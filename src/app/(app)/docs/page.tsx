import { PageHeader } from "@/components/ui";

export const metadata = { title: "Docs" };

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-paper">
      {children}
    </pre>
  );
}

const TOC = [
  ["#quickstart", "Quickstart"],
  ["#concepts", "Concepts"],
  ["#cli", "CLI reference"],
  ["#format", "Data format"],
  ["#faq", "FAQ"],
] as const;

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Docs" sub="Everything you need to wire VibeLog into your agents" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="max-lg:hidden">
          <ul className="sticky top-8 space-y-1 border-l border-line pl-4 text-[13px]">
            {TOC.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="block py-1 text-ink-2 hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-2xl space-y-12 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:text-sm [&_h3]:font-medium [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink-2">
          <section id="quickstart" className="space-y-4 scroll-mt-8">
            <h2>Quickstart</h2>
            <p>
              VibeLog records agent sessions the way a flight recorder records an aircraft: every
              prompt, tool call, output, and token count, written to an append-only log on your own
              disk. Install the CLI, then run your agent through it.
            </p>
            <CodeBlock>{`npm install -g vibelog

# wrap any agent command — nothing else changes
vibelog record -- claude -p "fix the failing test"

# or watch a directory your agents already log to
vibelog watch ~/.claude/projects`}</CodeBlock>
            <p>
              The first recording creates <code className="font-mono text-ink">~/.vibelog</code>.
              Open the workspace with <code className="font-mono text-ink">vibelog open</code> — it
              serves this UI on localhost and never binds to a public interface.
            </p>
          </section>

          <section id="concepts" className="space-y-4 scroll-mt-8">
            <h2>Concepts</h2>
            <h3>Sessions</h3>
            <p>
              A session is one run of one agent: a prompt in, work in the middle, a result out.
              Sessions carry an id, the model, the git branch they ran on, and a cost computed from
              recorded token counts at the rates you set.
            </p>
            <h3>The tape</h3>
            <p>
              Every session renders as a tape — a strip of the whole run where each mark is an
              event. Tall marks are prompts and outputs, medium marks are tool calls, short marks
              are reasoning. You can read a session&apos;s shape before you read a word of it: a
              healthy run settles into a steady rhythm of tool calls; a stuck one shows long
              silent gaps or a cluster of red.
            </p>
            <h3>Events</h3>
            <p>
              Events are the atoms: prompt, reasoning, tool call, output, checkpoint, error. Each
              records its offset from session start, its duration, and its token count where one
              applies.
            </p>
          </section>

          <section id="cli" className="space-y-4 scroll-mt-8">
            <h2>CLI reference</h2>
            <CodeBlock>{`vibelog record -- <cmd>   run a command and record it as a session
vibelog watch <dir>       tail an agent's own log directory
vibelog ls                list sessions, newest first
vibelog open [id]         open the workspace, or one session
vibelog export [id]       write NDJSON to stdout
vibelog gc                apply the retention policy now`}</CodeBlock>
            <p>
              Every command reads and writes only inside{" "}
              <code className="font-mono text-ink">~/.vibelog</code>. There is no login, no
              telemetry, and no network access unless you add a remote in Settings.
            </p>
          </section>

          <section id="format" className="space-y-4 scroll-mt-8">
            <h2>Data format</h2>
            <p>
              Sessions are newline-delimited JSON, one event per line, first line is the header.
              The format is stable and boring on purpose — you can parse it with a shell one-liner.
            </p>
            <CodeBlock>{`{"v":1,"id":"S-0998","agent":"claude-code","model":"claude-fable-5","branch":"fix/invoice-tz"}
{"at":0,"kind":"prompt","tokens":1204,"text":"Fix timezone bug in the invoice scheduler..."}
{"at":14,"kind":"tool","label":"Read src/invoices/scheduler.ts","durMs":180}
{"at":96,"kind":"output","tokens":412,"text":"The scheduler stores wall-clock times..."}`}</CodeBlock>
          </section>

          <section id="faq" className="space-y-5 scroll-mt-8">
            <h2>FAQ</h2>
            <div>
              <h3>Where does my data go?</h3>
              <p className="mt-1">
                Nowhere. Recordings live in <code className="font-mono text-ink">~/.vibelog</code>{" "}
                on the machine that ran the agent. Sharing with a team means pointing VibeLog at a
                directory you already sync — a repo, a network drive — not an account.
              </p>
            </div>
            <div>
              <h3>Does recording slow my agent down?</h3>
              <p className="mt-1">
                No. Events are buffered and flushed off the hot path; overhead measures under a
                millisecond per event.
              </p>
            </div>
            <div>
              <h3>What about secrets in prompts?</h3>
              <p className="mt-1">
                Redaction runs before anything touches disk. Values matching your{" "}
                <code className="font-mono text-ink">.env</code> keys are replaced with hashes, and
                you can add patterns of your own in Settings.
              </p>
            </div>
            <div>
              <h3>Which agents work?</h3>
              <p className="mt-1">
                Anything that runs as a command works with{" "}
                <code className="font-mono text-ink">vibelog record</code>. Claude Code, Codex, and
                anything that writes JSONL logs also work with{" "}
                <code className="font-mono text-ink">vibelog watch</code>, which needs no changes to
                how you launch your agent.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

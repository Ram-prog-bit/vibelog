import { PageHeader } from "@/components/ui";

export const metadata = { title: "Docs" };

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-code-bg p-4 font-mono text-[12.5px] leading-relaxed text-code-fg">
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

# record Claude Code sessions + serve this dashboard on localhost:3232
vibelog start

# demo mode — simulated agents, indistinguishable to the dashboard
vibelog start --mock`}</CodeBlock>
            <p>
              The first run creates <code className="font-mono text-ink">~/.vibelog</code> and
              serves this UI on localhost — it never binds to a public interface. Sessions your
              agents are running right now appear on Mission control within a second.
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
            <CodeBlock>{`vibelog start             record Claude Code sessions + serve the dashboard
vibelog start --mock      simulate a busy machine (demos, development)
vibelog start --port=N    dashboard port (default 3232)
vibelog start --no-dash   collector only, no dashboard server`}</CodeBlock>
            <p>
              Every command reads and writes only inside{" "}
              <code className="font-mono text-ink">~/.vibelog</code>. There is no login, no
              telemetry, and no network access. Real mode tails the transcripts Claude Code
              already writes under <code className="font-mono text-ink">~/.claude/projects</code>{" "}
              — no changes to how you launch your agent.
            </p>
          </section>

          <section id="format" className="space-y-4 scroll-mt-8">
            <h2>Data format</h2>
            <p>
              The collector writes one JSON snapshot to{" "}
              <code className="font-mono text-ink">~/.vibelog/state.json</code>: a timestamp and an
              array of sessions, each with its events. The dashboard streams it over SSE from{" "}
              <code className="font-mono text-ink">/api/stream</code>. The format is stable and
              boring on purpose — you can parse it with a shell one-liner.
            </p>
            <CodeBlock>{`{"now":1783133038322,"source":"claude-code","sessions":[
  {"id":"S-0998","agent":"claude-code","model":"claude-fable-5","status":"live",
   "branch":"fix/invoice-tz","tokensIn":50591,"tokensOut":4309,"costUsd":0.21,
   "events":[{"at":0,"kind":"prompt","label":"Task","tokens":1204},
             {"at":14,"kind":"tool","label":"Read src/invoices/scheduler.ts","durMs":180}]}
]}`}</CodeBlock>
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
                No. The collector reads the transcripts your agent already writes — nothing runs in
                the agent&apos;s path.
              </p>
            </div>
            <div>
              <h3>Which agents work?</h3>
              <p className="mt-1">
                Claude Code works today: <code className="font-mono text-ink">vibelog start</code>{" "}
                tails its JSONL transcripts with no changes to how you launch it. Other agents that
                write JSONL logs are next; <code className="font-mono text-ink">--mock</code> shows
                the full experience meanwhile.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

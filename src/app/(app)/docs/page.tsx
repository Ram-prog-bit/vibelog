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
  ["#team", "Team mode"],
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
            <CodeBlock>{`npm install -g vibelogapp

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
vibelog start --no-dash   collector only, no dashboard server
vibelog start --host      team mode: open the dashboard to your LAN
vibelog connect <ip>      team mode: send this machine's sessions to a host`}</CodeBlock>
            <p>
              Press <code className="font-mono text-ink">⌘K</code> /{" "}
              <code className="font-mono text-ink">Ctrl+K</code> anywhere in the dashboard to
              search every recorded session — titles, prompt text, file paths, bash commands,
              outputs, models, and branches.
            </p>
            <p>
              Every command reads and writes only inside{" "}
              <code className="font-mono text-ink">~/.vibelog</code>. There is no login, no
              telemetry, and no network access. Real mode tails the transcripts Claude Code
              already writes under <code className="font-mono text-ink">~/.claude/projects</code>{" "}
              — no changes to how you launch your agent.
            </p>
          </section>

          <section id="team" className="space-y-4 scroll-mt-8">
            <h2>Team mode</h2>
            <p>
              One dashboard for every machine on your LAN. One person hosts; everyone else
              connects. Sessions from each machine appear on the host&apos;s dashboard labeled
              with the machine&apos;s hostname, and Mission control groups them per machine.
            </p>
            <CodeBlock>{`# on the machine that will show the dashboard
vibelog start --host        # prints the address teammates should use

# on every other machine
vibelog connect 192.168.1.20`}</CodeBlock>
            <p>
              Still fully local: connected machines POST their session data straight to the
              host&apos;s <code className="font-mono text-ink">/api/ingest</code> over your LAN.
              No cloud, no accounts.
            </p>
            <p className="rounded-lg border border-line-2 bg-wash px-4 py-3">
              <strong className="text-ink">Security, stated plainly:</strong> team mode has no
              authentication in v1. While <code className="font-mono text-ink">--host</code> is
              running, anyone who can reach that port on your network can read every recorded
              session — prompts and outputs included — and post sessions of their own. Use it on
              networks you trust, and never port-forward it to the internet. Without{" "}
              <code className="font-mono text-ink">--host</code>, the dashboard binds to
              localhost only.
            </p>
          </section>

          <section id="format" className="space-y-4 scroll-mt-8">
            <h2>Data format</h2>
            <p>
              The collector writes one JSON snapshot to{" "}
              <code className="font-mono text-ink">~/.vibelog/state.json</code>: a timestamp and an
              array of sessions, each with its events. The dashboard streams it over SSE from{" "}
              <code className="font-mono text-ink">/api/stream</code> — a full snapshot when you
              connect, then only the sessions that changed. The file format is stable and boring
              on purpose — you can parse it with a shell one-liner.
            </p>
            <CodeBlock>{`{"now":1783133038322,"source":"claude-code",
 "project":{"projectName":"acme-web","gitBranch":"fix/invoice-tz"},
 "sessions":[
  {"id":"S-0998","agent":"claude-code","model":"claude-fable-5","status":"live",
   "gitBranch":"fix/invoice-tz","gitRepo":"acme-web","projectName":"acme-web",
   "projectId":"a1c3e5f7-…","tokensIn":50591,"tokensOut":4309,"costUsd":0.21,
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Network, ShieldCheck, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TruthLens — Find what researchers missed. Verify what they claim." },
      {
        name: "description",
        content:
          "TruthLens discovers research gaps and evaluates scientific reliability by detecting contradictions, conflicting studies, and weak evidence.",
      },
      { property: "og:title", content: "TruthLens — Research Reliability Engine" },
      {
        property: "og:description",
        content:
          "Upload research papers. Get a reliability score, contradictions, and the questions worth asking next.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" />
          TruthLens
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#how" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            How it works
          </a>
          <a href="#rubric" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Rubric
          </a>
          <Link
            to="/auth"
            className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-28 md:pt-32 md:pb-40">
        <div className="absolute inset-0 -z-10 tlx-grain opacity-50" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            Research reliability engine
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Find what researchers missed.
            <br />
            <span className="text-muted-foreground">Verify what they claim.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-base text-muted-foreground md:text-lg">
            TruthLens discovers research gaps and evaluates scientific reliability by detecting
            contradictions, conflicting studies, and weak evidence.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Upload Papers
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#example"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium hover:bg-accent"
            >
              See Example Analysis
            </a>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-5xl">
          <div className="tlx-hairline rounded-2xl bg-card p-2">
            <div className="rounded-xl border border-border bg-background p-8">
              <div className="grid grid-cols-12 items-center gap-6">
                <div className="col-span-12 md:col-span-5">
                  <div className="font-mono text-xs text-muted-foreground">PAPER 01</div>
                  <div className="mt-1 text-lg font-medium leading-snug">
                    Effects of intermittent fasting on metabolic markers
                  </div>
                  <div className="mt-6 flex items-baseline gap-2">
                    <div className="text-6xl font-semibold tabular-nums">84</div>
                    <div className="text-sm text-muted-foreground">/ 100</div>
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Reliable, with minor limitations
                  </div>
                </div>
                <div className="col-span-12 space-y-2 md:col-span-7">
                  {[
                    ["Source credibility", 13, 15],
                    ["Methodology", 17, 20],
                    ["Evidence strength", 16, 20],
                    ["Internal consistency", 13, 15],
                    ["External validation", 12, 15],
                    ["Bias / COI", 8, 10],
                    ["Timeliness", 5, 5],
                  ].map(([label, v, max]) => (
                    <div key={label as string} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 text-xs text-muted-foreground">{label}</div>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-foreground"
                          style={{ width: `${((v as number) / (max as number)) * 100}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-xs tabular-nums">
                        {v as number}/{max as number}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Two questions
              </div>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                Where should I research next?
                <br />
                Can I trust this paper?
              </h2>
              <p className="mt-5 max-w-md text-muted-foreground">
                Upload one or many papers. TruthLens reads them, cross-references claims, and
                returns evidence-grounded answers — not a summary.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
              {[
                {
                  icon: Lightbulb,
                  title: "Research Gap Finder",
                  text: "Established knowledge, unanswered questions, missing variables, and researchable next steps.",
                },
                {
                  icon: ShieldCheck,
                  title: "Reliability Checker",
                  text: "100-point rubric covering credibility, methodology, evidence, consistency, bias and more.",
                },
                {
                  icon: Network,
                  title: "Knowledge Graph",
                  text: "Visual map of agreements and contradictions across every paper you upload.",
                },
                {
                  icon: FileText,
                  title: "PDF · DOCX · TXT",
                  text: "Drop in papers, articles, reports — TruthLens extracts text and analyzes locally first.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="bg-background p-6">
                  <Icon className="h-5 w-5" />
                  <div className="mt-4 font-medium">{title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="rubric" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            The 100-point rubric
          </div>
          <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">
            Every score is justified with evidence from the paper.
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            {[
              ["Source credibility", 15],
              ["Methodology", 20],
              ["Evidence strength", 20],
              ["Internal consistency", 15],
              ["External validation", 15],
              ["Bias / COI", 10],
              ["Timeliness", 5],
              ["Total", 100],
            ].map(([label, pts], i) => (
              <div
                key={label as string}
                className={`bg-background p-6 ${i === 7 ? "md:col-span-1" : ""}`}
              >
                <div className="text-3xl font-semibold tabular-nums">{pts as number}</div>
                <div className="mt-1 text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="example" className="border-t border-border bg-foreground text-background">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Stop trusting abstracts. Start verifying claims.
          </h2>
          <p className="mx-auto mt-5 max-w-xl opacity-70">
            TruthLens is built for researchers, students, journalists, and anyone who needs to
            know what the evidence actually says.
          </p>
          <Link
            to="/auth"
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-background/90"
          >
            Get started — it's free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} TruthLens</div>
          <div className="font-mono">v0.1</div>
        </div>
      </footer>
    </div>
  );
}

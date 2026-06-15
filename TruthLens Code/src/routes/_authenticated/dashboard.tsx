import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAnalyses } from "@/lib/analyze.functions";
import { ArrowUpRight, Upload, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TruthLens" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(listAnalyses);
  const { data, isLoading } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => fn(),
  });

  const analyses = data ?? [];
  const total = analyses.length;
  type R = { overall_score?: number };
  const avg =
    total > 0
      ? Math.round(
          analyses.reduce((acc, a) => {
            const rel = (a.reliability as R[] | null) ?? [];
            const m = rel.length ? rel.reduce((s, r) => s + (r.overall_score ?? 0), 0) / rel.length : 0;
            return acc + m;
          }, 0) / total,
        )
      : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome back.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a paper to start, or revisit a previous analysis.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Upload className="h-4 w-4" /> Upload
        </Link>
      </div>

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
        <Stat label="Total analyses" value={String(total)} />
        <Stat label="Avg reliability" value={total ? `${avg} / 100` : "—"} />
        <Stat label="Papers indexed" value={String(analyses.reduce((s, a) => s + (a.document_ids?.length ?? 0), 0))} />
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent analyses</h2>
          <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
          {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && analyses.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">No analyses yet.</div>
              <Link
                to="/upload"
                className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
              >
                Run your first analysis
              </Link>
            </div>
          )}
          {analyses.slice(0, 8).map((a) => {
            const rel = (a.reliability as R[] | null) ?? [];
            const score =
              rel.length > 0
                ? Math.round(rel.reduce((s, r) => s + (r.overall_score ?? 0), 0) / rel.length)
                : null;
            return (
              <Link
                key={a.id}
                to="/results/$id"
                params={{ id: a.id }}
                className="flex items-center justify-between gap-4 p-5 hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.title}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()} ·{" "}
                    {a.document_ids?.length ?? 0} paper(s)
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {score !== null && (
                    <div className="text-right">
                      <div className="text-xl font-semibold tabular-nums">{score}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        avg
                      </div>
                    </div>
                  )}
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

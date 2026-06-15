import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAnalyses, deleteAnalysis } from "@/lib/analyze.functions";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — TruthLens" }] }),
  component: History,
});

type R = { overall_score?: number };

function History() {
  const fn = useServerFn(listAnalyses);
  const delFn = useServerFn(deleteAnalysis);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["analyses"], queryFn: () => fn() });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await delFn({ data: { id } });
      toast.success("Analysis deleted");
      await qc.invalidateQueries({ queryKey: ["analyses"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Archive
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every analysis you've run.</p>

      <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data ?? []).length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No analyses yet.</div>
        )}
        {(data ?? []).map((a) => {
          const rel = (a.reliability as R[] | null) ?? [];
          const score =
            rel.length > 0
              ? Math.round(rel.reduce((s, r) => s + (r.overall_score ?? 0), 0) / rel.length)
              : null;
          return (
            <div key={a.id} className="group flex items-stretch hover:bg-accent">
              <Link
                to="/results/$id"
                params={{ id: a.id }}
                className="flex flex-1 items-center justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.title}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()} ·{" "}
                    {a.document_ids?.length ?? 0} paper(s)
                  </div>
                </div>
                {score !== null && (
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">{score}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      avg / 100
                    </div>
                  </div>
                )}
              </Link>
              <button
                onClick={(e) => handleDelete(e, a.id, a.title)}
                disabled={deletingId === a.id}
                aria-label="Delete analysis"
                className="flex items-center justify-center px-4 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {deletingId === a.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

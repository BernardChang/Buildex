import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAnalyses, getAnalysis } from "@/lib/analyze.functions";
import { GapsView } from "@/components/gaps-view";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gaps")({
  head: () => ({ meta: [{ title: "Research Gaps — TruthLens" }] }),
  component: GapsPage,
});

function GapsPage() {
  const listFn = useServerFn(listAnalyses);
  const getFn = useServerFn(getAnalysis);
  const { data: list } = useQuery({ queryKey: ["analyses"], queryFn: () => listFn() });
  const latestId = list?.[0]?.id;
  const { data: latest, isLoading } = useQuery({
    queryKey: ["analysis", latestId],
    queryFn: () => getFn({ data: { id: latestId! } }),
    enabled: !!latestId,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Question 1
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Where should I research next?
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Established knowledge, unanswered questions, and researchable next steps from your most
        recent analysis.
      </p>

      {!latestId && (
        <Empty />
      )}
      {latestId && isLoading && <div className="mt-8 text-sm text-muted-foreground">Loading…</div>}
      {latest?.gaps && (
        <div className="mt-10">
          <GapsView gaps={latest.gaps as never} />
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center">
      <div className="text-sm text-muted-foreground">No analyses yet.</div>
      <Link
        to="/upload"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm text-background"
      >
        Upload a paper <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

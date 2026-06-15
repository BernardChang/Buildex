import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getAnalysis,
  reanalyzeAnalysis,
  askAboutAnalysis,
} from "@/lib/analyze.functions";
import { GapsView } from "@/components/gaps-view";
import { ReliabilityView } from "@/components/reliability-view";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { ArrowLeft, RefreshCw, Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/lib/preferences";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/results/$id")({
  head: () => ({ meta: [{ title: "Analysis — TruthLens" }] }),
  component: ResultsPage,
});

type Tab = "gaps" | "reliability" | "graph";
type ChatMsg = { role: "user" | "assistant"; content: string };

function ResultsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { prefs } = usePreferences();
  const fn = useServerFn(getAnalysis);
  const reanalyzeFn = useServerFn(reanalyzeAnalysis);
  const askFn = useServerFn(askAboutAnalysis);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fn({ data: { id } }),
  });
  const [tab, setTab] = useState<Tab>("gaps");
  const [reanalyzing, setReanalyzing] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error || !data)
    return (
      <div className="text-sm text-muted-foreground">
        Could not load this analysis.{" "}
        <Link to="/history" className="underline">
          Back to history
        </Link>
      </div>
    );

  async function handleReanalyze() {
    if (reanalyzing) return;
    setReanalyzing(true);
    try {
      const res = await reanalyzeFn({ data: { id } });
      toast.success("Reanalysis complete");
      await qc.invalidateQueries({ queryKey: ["analyses"] });
      navigate({ to: "/results/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reanalysis failed");
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    const nextHistory = [...chat, { role: "user" as const, content: q }];
    setChat(nextHistory);
    setQuestion("");
    setAsking(true);
    try {
      const res = await askFn({ data: { id, question: q, history: chat } });
      setChat([...nextHistory, { role: "assistant", content: res.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get answer");
      setChat(nextHistory);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        to="/history"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> History
      </Link>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{data.title}</h1>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {new Date(data.created_at).toLocaleString()} ·{" "}
            {data.document_ids?.length ?? 0} paper(s)
          </div>
        </div>
        <button
          onClick={handleReanalyze}
          disabled={reanalyzing}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
        >
          {reanalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {reanalyzing ? "Reanalyzing…" : "Reanalyze"}
        </button>
      </div>

      <div className="mt-8 flex gap-1 border-b border-border">
        {(
          [
            ["gaps", "Research Gaps"],
            ["reliability", "Reliability"],
            ["graph", "Knowledge Graph"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "gaps" && data.gaps && <GapsView gaps={data.gaps as never} />}
        {tab === "reliability" && data.reliability && (
          <ReliabilityView
            reliability={data.reliability as never}
            evidence={(data.graph as { openalex?: never } | null)?.openalex as never}
          />
        )}
        {tab === "graph" && data.graph && <KnowledgeGraph graph={data.graph as never} />}
        {tab === "gaps" && !data.gaps && <Empty />}
        {tab === "reliability" && !data.reliability && <Empty />}
        {tab === "graph" && !data.graph && <Empty />}
      </div>

      {prefs.modules.sideAssistant && (
        <div className="mt-12 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Sparkles className="h-4 w-4" />
            <div className="text-sm font-medium">Ask TruthLens about this analysis</div>
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto p-5">
            {chat.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Ask follow-up questions about the paper, methodology, evidence, or scoring.
                Answers are grounded in the uploaded text and scientific literature retrieved from OpenAlex, Semantic Scholar, and CrossRef.
              </div>
            )}
            {chat.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-8 bg-accent"
                    : "mr-8 border border-border bg-background whitespace-pre-wrap",
                )}
              >
                {m.content}
              </div>
            ))}
            {asking && (
              <div className="mr-8 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>
          <form onSubmit={handleAsk} className="flex gap-2 border-t border-border p-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What are the strongest weaknesses?"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
              disabled={asking}
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      No data for this section.
    </div>
  );
}

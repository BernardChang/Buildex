interface ScoreItem {
  score: number;
  max: number;
  reason: string;
}
interface EvidencePaper {
  evidence_id?: string;
  title: string;
  year: number;
  citations: number;
  is_review?: boolean;
  finding: string;
  disagreement_reason?: string;
  disagreement?: string; // legacy
}

interface InternalBreakdown {
  source_credibility: ScoreItem;
  methodology_quality: ScoreItem;
  evidence_strength: ScoreItem;
  internal_consistency: ScoreItem;
  bias: ScoreItem;
  timeliness: ScoreItem;
}
interface ExternalBreakdown {
  consensus_support: ScoreItem;
  replication: ScoreItem;
  contradicting: ScoreItem;
  retraction_status: ScoreItem;
}

interface ReliabilityItem {
  paper_index: number;
  paper_title: string;
  paper_type?: string;
  overall_score: number;
  raw_score?: number;
  applied_cap?: number | null;
  cap_reason?: string;
  internal_score?: number;
  external_score?: number;
  rating_category: string;
  internal_breakdown?: InternalBreakdown;
  // legacy field name from prior version
  breakdown?: InternalBreakdown;
  external_breakdown?: ExternalBreakdown;
  explanation: string;
  strengths: string[];
  weaknesses: string[];
  internal_contradictions?: string[];
  supporting_papers?: EvidencePaper[];
  contradicting_papers?: EvidencePaper[];
  consensus?: string;
  challenge_status?: string;
  retraction_status?: string;
  external_summary?: string;
  external_reason?: string; // legacy
  confidence_level: string;
  confidence_reason: string;
}

interface OpenAlexResult {
  id: string;
  title: string;
  year: number | null;
  citations: number;
  url: string;
  authors: string[];
  venue: string | null;
  is_retracted?: boolean;
  is_review?: boolean;
}
interface EvidenceBundle {
  paper_index: number;
  query?: string;
  paper_type?: string;
  results: OpenAlexResult[];
  retraction_hits?: OpenAlexResult[];
  counts?: { reviews: number; top_cited: number; recent: number; retraction: number };
}

export function ReliabilityView({
  reliability,
  evidence,
}: {
  reliability: ReliabilityItem[];
  evidence?: EvidenceBundle[];
}) {
  return (
    <div className="space-y-10">
      {reliability.map((r) => {
        const ev = evidence?.find((e) => e.paper_index === r.paper_index);
        return <PaperCard key={r.paper_index} r={r} evidence={ev} />;
      })}
    </div>
  );
}

function PaperCard({ r, evidence }: { r: ReliabilityItem; evidence?: EvidenceBundle }) {
  const ib = r.internal_breakdown ?? r.breakdown;
  const internalItems: [string, ScoreItem | undefined][] = ib
    ? [
        ["Source credibility", ib.source_credibility],
        ["Methodology quality", ib.methodology_quality],
        ["Evidence strength", ib.evidence_strength],
        ["Internal consistency", ib.internal_consistency],
        ["Bias / COI", ib.bias],
        ["Timeliness", ib.timeliness],
      ]
    : [];
  const eb = r.external_breakdown;
  const externalItems: [string, ScoreItem | undefined][] = eb
    ? [
        ["Consensus support", eb.consensus_support],
        ["Independent replication", eb.replication],
        ["Contradicting studies", eb.contradicting],
        ["Retraction / challenge", eb.retraction_status],
      ]
    : [];

  const internalMax = internalItems.reduce((s, [, x]) => s + (x?.max ?? 0), 0) || 65;
  const externalMax = externalItems.reduce((s, [, x]) => s + (x?.max ?? 0), 0) || 35;

  const internal =
    r.internal_score ?? internalItems.reduce((s, [, x]) => s + (x?.score ?? 0), 0);
  const external =
    r.external_score ?? externalItems.reduce((s, [, x]) => s + (x?.score ?? 0), 0);

  const capped =
    r.applied_cap != null && r.applied_cap < (r.raw_score ?? r.overall_score);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-12 gap-6 border-b border-border p-6">
        <div className="col-span-12 md:col-span-7">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Paper {r.paper_index}</span>
            {r.paper_type && <Pill>{r.paper_type}</Pill>}
          </div>
          <div className="mt-1 text-lg font-semibold leading-snug">{r.paper_title}</div>
          <div className="mt-3 text-sm text-muted-foreground">{r.explanation}</div>
          {evidence?.query && (
            <div className="mt-3 font-mono text-[11px] text-muted-foreground">
              Search:{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 text-foreground/80">
                {evidence.query}
              </span>
            </div>
          )}
        </div>
        <div className="col-span-12 md:col-span-5">
          <div className="flex items-baseline gap-2">
            <div className="text-6xl font-semibold tabular-nums">{r.overall_score}</div>
            <div className="text-sm text-muted-foreground">/ 100</div>
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {r.rating_category}
          </div>
          {capped && (
            <div className="mt-2 rounded-md border border-foreground/40 bg-muted/50 px-2.5 py-1.5 text-[11px] text-foreground">
              <span className="font-mono uppercase tracking-wider">Cap applied</span> · raw{" "}
              {r.raw_score} → {r.applied_cap}
              {r.cap_reason ? ` · ${r.cap_reason}` : ""}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <ScoreChip label="Internal" value={internal} max={internalMax} />
            <ScoreChip label="External" value={external} max={externalMax} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.consensus && <Pill>Consensus: {r.consensus}</Pill>}
            {r.challenge_status && <Pill>{r.challenge_status}</Pill>}
            {r.retraction_status && r.retraction_status !== "None detected" && (
              <Pill>{r.retraction_status}</Pill>
            )}
            <Pill>Confidence: {r.confidence_level}</Pill>
          </div>
        </div>
      </div>

      {internalItems.length > 0 && (
        <BreakdownSection
          title="Internal reliability"
          subtitle={`${internal} / ${internalMax}`}
          items={internalItems}
        />
      )}

      {externalItems.length > 0 && (
        <BreakdownSection
          title="External validation"
          subtitle={`${external} / ${externalMax} · OpenAlex + Semantic Scholar + CrossRef`}
          items={externalItems}
        />
      )}

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
        <List title="Strengths" items={r.strengths} />
        <List title="Weaknesses" items={r.weaknesses} />
      </div>

      {(r.internal_contradictions ?? []).length > 0 && (
        <div className="border-t border-border p-6">
          <List
            title="Internal contradictions"
            items={r.internal_contradictions ?? []}
            subtle
          />
        </div>
      )}

      <div className="border-t border-border p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wider">
          What the literature says
          {evidence?.counts && (
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              {evidence.results.length} papers · {evidence.counts.reviews} review/meta ·{" "}
              {evidence.counts.retraction} retraction hit(s)
            </span>
          )}
        </h4>
        {(r.external_summary || r.external_reason) && (
          <p className="mt-2 text-sm text-foreground/80">
            {r.external_summary || r.external_reason}
          </p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <EvidenceList
            title="Supporting papers"
            tone="support"
            papers={r.supporting_papers}
            lookup={evidence?.results}
          />
          <EvidenceList
            title="Contradicting papers"
            tone="contra"
            papers={r.contradicting_papers}
            lookup={evidence?.results}
          />
        </div>

        {(evidence?.retraction_hits?.length ?? 0) > 0 && (
          <div className="mt-6">
            <h5 className="text-xs font-semibold uppercase tracking-wider">
              Retraction sweep hits
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                title match against scientific literature index (is_retracted:true)
              </span>
            </h5>
            <ul className="mt-3 space-y-2">
              {evidence!.retraction_hits!.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-foreground/40 bg-muted/40 p-3 text-xs"
                >
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {p.title}
                  </a>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {p.year ?? "n.d."} · {p.citations.toLocaleString()} cites
                    {p.venue ? ` · ${p.venue}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-muted/50 p-6 text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-wider">Confidence note</span> ·{" "}
        {r.confidence_reason}
      </div>
    </div>
  );
}

function BreakdownSection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: [string, ScoreItem | undefined][];
}) {
  return (
    <div className="border-b border-border p-6">
      <h4 className="text-sm font-semibold uppercase tracking-wider">
        {title}
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">{subtitle}</span>
      </h4>
      <div className="mt-4 space-y-2.5">
        {items.map(([label, s]) => (
          <div key={label} className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-4 text-xs text-muted-foreground md:col-span-3">
              {label}
            </div>
            <div className="col-span-5 h-1.5 overflow-hidden rounded-full bg-muted md:col-span-7">
              <div
                className="h-full bg-foreground"
                style={{ width: `${((s?.score ?? 0) / (s?.max || 1)) * 100}%` }}
              />
            </div>
            <div className="col-span-3 text-right font-mono text-xs tabular-nums md:col-span-2">
              {s?.score ?? 0} / {s?.max ?? 0}
            </div>
            <div className="col-span-12 -mt-1 pl-0 text-xs text-muted-foreground md:col-span-9 md:col-start-4">
              {s?.reason}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreChip({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">
        {value} <span className="text-muted-foreground">/ {max}</span>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

function List({
  title,
  items,
  subtle,
}: {
  title: string;
  items: string[];
  subtle?: boolean;
}) {
  return (
    <div>
      <h5
        className={`text-xs font-semibold uppercase tracking-wider ${
          subtle ? "text-muted-foreground" : ""
        }`}
      >
        {title}
      </h5>
      <ul className="mt-3 space-y-2">
        {(items ?? []).length === 0 && (
          <li className="text-xs text-muted-foreground">None found.</li>
        )}
        {(items ?? []).map((s, i) => (
          <li key={i} className="text-sm leading-snug">
            <span className="mr-2 text-muted-foreground">—</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceList({
  title,
  tone,
  papers,
  lookup,
}: {
  title: string;
  tone: "support" | "contra";
  papers?: EvidencePaper[];
  lookup?: OpenAlexResult[];
}) {
  const list = papers ?? [];
  return (
    <div>
      <h5 className="text-xs font-semibold uppercase tracking-wider">
        {title}
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
          {list.length}
        </span>
      </h5>
      <ul className="mt-3 space-y-3">
        {list.length === 0 && (
          <li className="text-xs text-muted-foreground">
            No {tone === "support" ? "supporting" : "contradicting"} papers identified in the literature search.
          </li>
        )}
        {list.map((p, i) => {
          const idx = p.evidence_id
            ? parseInt(p.evidence_id.replace(/[^\d]/g, ""), 10) - 1
            : -1;
          const src = lookup && idx >= 0 ? lookup[idx] : undefined;
          const reason = p.disagreement_reason ?? p.disagreement;
          return (
            <li
              key={i}
              className={`rounded-md border p-3 ${
                tone === "support"
                  ? "border-border bg-background"
                  : "border-foreground/30 bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium leading-snug">
                  {src ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                </div>
                <div className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {p.year || "n.d."} · {p.citations.toLocaleString()} cites
                </div>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                {(p.is_review || src?.is_review) && (
                  <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider">
                    Review / meta
                  </span>
                )}
                {src?.is_retracted && (
                  <span className="rounded bg-foreground/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-background">
                    Retracted
                  </span>
                )}
                {src?.venue && (
                  <span className="text-[11px] text-muted-foreground">{src.venue}</span>
                )}
              </div>
              <div className="mt-2 text-xs text-foreground/80">{p.finding}</div>
              {reason && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono uppercase tracking-wider">Why it conflicts</span> ·{" "}
                  {reason}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

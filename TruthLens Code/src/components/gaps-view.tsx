interface Gaps {
  established_knowledge?: { point: string; evidence?: string }[];
  unanswered_questions?: { question: string; why_it_matters?: string }[];
  missing_areas?: { area: string; explanation?: string }[];
  suggested_research_questions?: {
    question: string;
    variables?: string[];
    controls?: string[];
    impact?: string;
    novelty?: "low" | "medium" | "high";
  }[];
}

export function GapsView({ gaps }: { gaps: Gaps }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="Established Knowledge" hint="Findings shared across uploaded papers.">
        <ul className="space-y-3">
          {(gaps.established_knowledge ?? []).map((e, i) => (
            <li key={i} className="border-l-2 border-foreground pl-3">
              <div className="text-sm">{e.point}</div>
              {e.evidence && (
                <div className="mt-1 text-xs italic text-muted-foreground">"{e.evidence}"</div>
              )}
            </li>
          ))}
          {(gaps.established_knowledge ?? []).length === 0 && <Empty />}
        </ul>
      </Card>

      <Card title="Unanswered Questions" hint="Important unresolved questions.">
        <ul className="space-y-3">
          {(gaps.unanswered_questions ?? []).map((q, i) => (
            <li key={i} className="rounded-md bg-muted p-3">
              <div className="text-sm font-medium">{q.question}</div>
              {q.why_it_matters && (
                <div className="mt-1 text-xs text-muted-foreground">{q.why_it_matters}</div>
              )}
            </li>
          ))}
          {(gaps.unanswered_questions ?? []).length === 0 && <Empty />}
        </ul>
      </Card>

      <Card title="Missing Areas" hint="Topics or variables not adequately addressed.">
        <ul className="space-y-3">
          {(gaps.missing_areas ?? []).map((m, i) => (
            <li key={i}>
              <div className="text-sm font-medium">{m.area}</div>
              {m.explanation && (
                <div className="mt-1 text-xs text-muted-foreground">{m.explanation}</div>
              )}
            </li>
          ))}
          {(gaps.missing_areas ?? []).length === 0 && <Empty />}
        </ul>
      </Card>

      <Card title="Suggested Research Questions" hint="Researchable next steps." wide>
        <ul className="space-y-4">
          {(gaps.suggested_research_questions ?? []).map((s, i) => (
            <li key={i} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium">{s.question}</div>
                {s.novelty && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.novelty} novelty
                  </span>
                )}
              </div>
              {s.variables && s.variables.length > 0 && (
                <Pair label="Variables" items={s.variables} />
              )}
              {s.controls && s.controls.length > 0 && (
                <Pair label="Controls" items={s.controls} />
              )}
              {s.impact && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-mono uppercase tracking-wider">Impact</span> · {s.impact}
                </div>
              )}
            </li>
          ))}
          {(gaps.suggested_research_questions ?? []).length === 0 && <Empty />}
        </ul>
      </Card>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-6 ${wide ? "md:col-span-2" : ""}`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Pair({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {items.map((v, i) => (
        <span
          key={i}
          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return <li className="text-xs text-muted-foreground">No items identified.</li>;
}

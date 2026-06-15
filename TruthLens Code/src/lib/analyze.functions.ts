import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PaperInput = z.object({
  title: z.string().min(1).max(400),
  text: z.string().min(1).max(120_000),
});

const AnalyzeInput = z.object({
  title: z.string().min(1).max(200),
  papers: z.array(PaperInput).min(1).max(8),
  documentIds: z.array(z.string()).default([]),
});

// ---------- Step 1: extract structured search metadata per paper ----------

const EXTRACT_SYSTEM = `You are a research librarian. For each uploaded paper, extract the
concepts, keywords, organism/disease/method, variables, and paper type that would let us
retrieve genuinely related literature from OpenAlex. Return ONLY valid JSON. No prose.`;

function buildExtractPrompt(papers: Array<{ title: string; text: string }>) {
  const blocks = papers
    .map(
      (p, i) =>
        `=== PAPER ${i + 1}: ${p.title} ===\n${p.text.slice(0, 12_000)}\n=== END PAPER ${i + 1} ===`,
    )
    .join("\n\n");

  return `Return JSON of shape:
{
  "papers": [
    {
      "index": number,
      "search_query": string,          // 4-10 KEYWORDS only, NOT the title. Concepts + organism + disease + method.
      "keywords": [string],            // 3-8 specific terms
      "concepts": [string],            // higher-level fields (e.g. "neurodegeneration", "ecology")
      "organism": string,              // "" if not applicable
      "disease": string,               // "" if not applicable
      "method": string,                // "" if not applicable
      "variables": [string],           // dependent/independent variables studied
      "authors": [string],             // up to 4 first authors
      "paper_type": "experimental" | "review" | "meta-analysis" | "theoretical" | "commentary" | "social-science" | "humanities" | "other",
      "main_claims": [string]          // 2-5 concrete claims the paper makes
    }
  ]
}

GOOD search_query: "amyloid beta oligomers Alzheimer memory impairment"
BAD search_query:  "A specific amyloid-β protein assembly in the brain impairs memory"

${blocks}`;
}

// ---------- Step 2: analyze with OpenAlex evidence pinned ----------

const ANALYZE_SYSTEM = `You are TruthLens, a rigorous scientific reviewer. You evaluate uploaded
papers on TWO dimensions:

  Internal Reliability  — 65 pts — from the paper itself.
  External Validation   — 35 pts — from the OpenAlex evidence corpus provided.

Final score (0-100) = internal + external, then apply caps if warranted.

ABSOLUTE RULES:
- NEVER invent external papers, citations, authors, journals, years, citation counts, or retractions.
- Every supporting_paper / contradicting_paper MUST come from the OpenAlex evidence list.
  Reference each by its [E#] id and copy the exact title/year/citations.
- Weight evidence by hierarchy: meta-analyses > systematic reviews > large replications >
  independent studies > the original paper. A single paper must NOT outweigh a broad consensus.
- If a [RETRACTED] evidence item plausibly refers to the uploaded paper (title/authors match),
  set retraction_status accordingly and cap the score.
- If evidence is empty/insufficient, say so: external_consensus_support low, consensus
  "Insufficient evidence", confidence "Low" — DO NOT zero everything out automatically.
- Distinguish "contradicted" / "challenged" / "limited" / "disproven" carefully.
- Apply the paper_type rubric: review papers must NOT lose methodology points for lacking experiments.
- You explain conclusions. You DO NOT determine truth without evidence.
- Return ONLY valid JSON matching the schema. No prose, no markdown.`;

function buildAnalyzePrompt(
  papers: Array<{ title: string; text: string; paper_type: string; main_claims: string[] }>,
  evidence: Array<{ paperIndex: number; lines: string[]; retractionLines: string[] }>,
) {
  const paperBlocks = papers
    .map(
      (p, i) =>
        `=== PAPER ${i + 1}: ${p.title} ===\nDetected type: ${p.paper_type}\nExtracted claims: ${
          p.main_claims.join(" | ") || "(none)"
        }\n${p.text.slice(0, 22_000)}\n=== END PAPER ${i + 1} ===`,
    )
    .join("\n\n");

  const evidenceBlocks = evidence
    .map((e) => {
      const main =
        e.lines.length === 0
          ? "(no results returned)"
          : e.lines.join("\n\n");
      const retract =
        e.retractionLines.length === 0
          ? "(no retraction hits)"
          : e.retractionLines.join("\n\n");
      return `=== OPENALEX EVIDENCE — PAPER ${e.paperIndex} (combined: reviews → most-cited → relevant → recent) ===
${main}
--- RETRACTION SWEEP (is_retracted:true matches for this paper's title) ---
${retract}
=== END EVIDENCE ${e.paperIndex} ===`;
    })
    .join("\n\n");

  return `Analyze the uploaded paper(s) AND the OpenAlex evidence retrieved for each.
Return a single JSON object with this exact shape:

{
  "gaps": {
    "established_knowledge": [{"point": string, "evidence": string}],
    "unanswered_questions": [{"question": string, "why_it_matters": string}],
    "missing_areas": [{"area": string, "explanation": string}],
    "suggested_research_questions": [{
      "question": string,
      "variables": [string],
      "controls": [string],
      "impact": string,
      "novelty": "low" | "medium" | "high"
    }]
  },
  "reliability": [
    {
      "paper_index": number,
      "paper_title": string,
      "paper_type": "experimental" | "review" | "meta-analysis" | "theoretical" | "commentary" | "social-science" | "humanities" | "other",
      "internal_score": number,       // sum of internal_breakdown, max 65
      "external_score": number,       // sum of external_breakdown, max 35
      "raw_score": number,            // internal_score + external_score, 0-100
      "applied_cap": number | null,   // e.g. 25 for retraction; null if no cap
      "cap_reason": string,           // "" if no cap
      "overall_score": number,        // min(raw_score, applied_cap ?? raw_score)
      "rating_category": "Very Reliable" | "Reliable, with Minor Limitations" | "Moderately Reliable" | "Weak Reliability" | "Unreliable or Disproven",
      "internal_breakdown": {
        "source_credibility":  {"score": number, "max": 10, "reason": string},
        "methodology_quality": {"score": number, "max": 15, "reason": string},
        "evidence_strength":   {"score": number, "max": 15, "reason": string},
        "internal_consistency":{"score": number, "max": 10, "reason": string},
        "bias":                {"score": number, "max": 10, "reason": string},
        "timeliness":          {"score": number, "max": 5,  "reason": string}
      },
      "external_breakdown": {
        "consensus_support":   {"score": number, "max": 15, "reason": string},
        "replication":         {"score": number, "max": 10, "reason": string},
        "contradicting":       {"score": number, "max": 5,  "reason": string},
        "retraction_status":   {"score": number, "max": 5,  "reason": string}
      },
      "explanation": string,
      "strengths": [string],
      "weaknesses": [string],
      "internal_contradictions": [string],
      "supporting_papers": [{
        "evidence_id": string,        // exact [E#] from the evidence block
        "title": string,
        "year": number,
        "citations": number,
        "is_review": boolean,
        "finding": string             // main conclusion (1-2 sentences)
      }],
      "contradicting_papers": [{
        "evidence_id": string,
        "title": string,
        "year": number,
        "citations": number,
        "is_review": boolean,
        "finding": string,
        "disagreement_reason": string // sample size, species, method, temperature, assumptions, statistics, etc.
      }],
      "consensus": "Strong consensus" | "Moderate consensus" | "Mixed evidence" | "Highly controversial" | "Strongly challenged" | "Insufficient evidence",
      "challenge_status": "Not challenged" | "Minor disagreement" | "Mixed findings" | "Strongly challenged" | "Possibly disproven",
      "retraction_status": "None detected" | "Expression of concern" | "Replication failure" | "Retracted",
      "external_summary": string,     // 2-3 sentences synthesizing what the literature says
      "confidence_level": "High" | "Medium" | "Low",
      "confidence_reason": string
    }
  ],
  "graph": {
    "nodes": [{"id": string, "title": string, "score": number}],
    "edges": [{"source": string, "target": string, "type": "agreement" | "contradiction" | "weak", "note": string}]
  }
}

SCORING PHILOSOPHY — be FAIR by default, BRUTAL on critical failures.
- Default posture: a competent, peer-reviewed paper with no red flags should land in
  the 75-90 range. Do not nickel-and-dime points for minor imperfections (small sample,
  narrow scope, single-lab study, no preregistration). Reserve big deductions for
  REAL problems with evidence behind them.
- Start each internal sub-score near the TOP of its range and subtract only for
  concrete, named issues. "Could be better" is not a deduction.
- External score: if evidence broadly agrees, award most of the 35 points. Lack of
  retrieved evidence is NOT proof of weakness — apply only a small reduction.

CRITICAL FAILURES — when one of these is clearly supported by evidence, apply the
cap aggressively. These overrule any internal quality:
- Retracted (evidence-confirmed)                         → cap 20
- Expression of concern                                  → cap 55
- Strong, replicated replication failure                 → cap 45
- Multiple high-quality meta-analyses contradicting core → cap 50
- Core claim disproven by consensus                      → cap 35
- Clear data fabrication / fraud signal                  → cap 15

Only apply a cap when the evidence is strong and on-topic. Do NOT cap for vague
"some disagreement" — that just lowers contradicting/consensus_support a bit.

EXTERNAL SCORE GUIDANCE — be LENIENT. The retrieved corpus is a sample from
OpenAlex (cross-indexed with Semantic Scholar and CrossRef metadata) and will
NEVER be exhaustive. Treat absence of contradiction as a positive signal, not
a neutral one. Start every external sub-score at or near its MAX and subtract
only for concrete, on-topic problems.
- consensus_support (15): start at 13. Award 15 if any review/meta-analysis or
  multiple independent papers broadly agree. Only drop below 10 if retrieved
  evidence clearly disagrees with the core claim.
- replication (10): start at 9. Award full 10 with any independent confirmation.
  Drop sharply ONLY on documented, on-topic replication failures.
- contradicting (5): start at 5. Subtract only for genuine, high-quality,
  on-topic contradictions — not for tangential or older disagreements.
- retraction_status (5): full 5 unless an actual retraction/EoC hit applies to
  THIS paper.

NO-EVIDENCE RULE: if combined evidence is empty or weak, default to
consensus="Insufficient evidence", confidence="Low", BUT keep external_score
>= 25 unless the paper itself has obvious internal red flags. Absence of
retrieved evidence is a search limitation, not a verdict.

When writing external_summary, supporting_papers reasons, and
external_breakdown reasons, refer to the source as "the scientific literature
(OpenAlex, Semantic Scholar, CrossRef)" — never name only one database.

PAPER-TYPE RUBRIC:
- review / meta-analysis: judge breadth, methodology of synthesis, inclusion criteria — NOT wet-lab methods.
- theoretical: judge logical consistency and assumptions.
- commentary: lower expectations on evidence_strength; weight bias more.

Rating bands (based on overall_score after caps):
  90-100 Very Reliable · 75-89 Reliable, with Minor Limitations · 60-74 Moderately Reliable
  40-59 Weak Reliability · 0-39 Unreliable or Disproven

Nodes: id = "p" + paper_index. Add edges only when justified by evidence.

${paperBlocks}

${evidenceBlocks}`;
}

// ---------- Server function ----------

interface ExtractedMeta {
  index: number;
  search_query: string;
  keywords: string[];
  concepts?: string[];
  organism?: string;
  disease?: string;
  method?: string;
  variables?: string[];
  authors?: string[];
  paper_type?: string;
  main_claims?: string[];
}

async function runAnalysisPipeline(
  data: { title: string; papers: Array<{ title: string; text: string }>; documentIds: string[] },
  userId: string,
  supabase: {
    from: (t: string) => {
      insert: (r: unknown) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  },
): Promise<{ id: string }> {
  const { callLovableAI } = await import("./ai-gateway.server");
  const { gatherEvidence, toEvidenceLine } = await import("./openalex.server");

  let extracted: { papers: ExtractedMeta[] };
  try {
    const rawExtract = await callLovableAI({
      system: EXTRACT_SYSTEM,
      user: buildExtractPrompt(data.papers),
      maxTokens: 2000,
    });
    extracted = JSON.parse(rawExtract);
  } catch {
    extracted = {
      papers: data.papers.map((p, i) => ({
        index: i + 1,
        search_query: p.title,
        keywords: [],
        paper_type: "other",
        main_claims: [],
      })),
    };
  }

  const evidence = await Promise.all(
    data.papers.map(async (p, i) => {
      const meta = extracted.papers.find((x) => x.index === i + 1);
      let q = (meta?.search_query || "").trim();
      if (!q || q.toLowerCase() === p.title.toLowerCase()) {
        q =
          [...(meta?.keywords ?? []), meta?.organism, meta?.disease, meta?.method]
            .filter(Boolean)
            .join(" ") || p.title;
      }
      const corpus = await gatherEvidence(q, p.title);
      const combined = corpus.combined.slice(0, 25);
      return {
        paperIndex: i + 1,
        query: q,
        paper_type: meta?.paper_type ?? "other",
        main_claims: meta?.main_claims ?? [],
        corpus,
        combined,
        lines: combined.map((r, idx) => toEvidenceLine(r, idx)),
        retractionLines: corpus.retractionHits.map((r, idx) => toEvidenceLine(r, idx)),
      };
    }),
  );

  const promptPapers = data.papers.map((p, i) => ({
    title: p.title,
    text: p.text,
    paper_type: evidence[i].paper_type,
    main_claims: evidence[i].main_claims,
  }));

  const raw = await callLovableAI({
    system: ANALYZE_SYSTEM,
    user: buildAnalyzePrompt(promptPapers, evidence),
    maxTokens: 9000,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("AI returned invalid JSON");
    parsed = JSON.parse(raw.slice(start, end + 1));
  }

  const evidenceMeta = evidence.map((e) => ({
    paper_index: e.paperIndex,
    query: e.query,
    paper_type: e.paper_type,
    results: e.combined,
    retraction_hits: e.corpus.retractionHits,
    counts: {
      reviews: e.corpus.reviews.length,
      top_cited: e.corpus.topCited.length,
      recent: e.corpus.recent.length,
      retraction: e.corpus.retractionHits.length,
    },
  }));

  const insertRow: {
    user_id: string;
    title: string;
    document_ids: string[];
    gaps: unknown;
    reliability: unknown;
    graph: Record<string, unknown>;
    status: string;
  } = {
    user_id: userId,
    title: data.title,
    document_ids: data.documentIds,
    gaps: parsed.gaps ?? null,
    reliability: parsed.reliability ?? null,
    graph:
      parsed.graph && typeof parsed.graph === "object"
        ? (parsed.graph as Record<string, unknown>)
        : { nodes: [], edges: [] },
    status: "complete",
  };
  insertRow.graph.openalex = evidenceMeta;

  const { data: row, error } = await supabase
    .from("analyses")
    .insert(insertRow as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Insert failed");
  return { id: row.id };
}

export const analyzeAndStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data, context }) => {
    return runAnalysisPipeline(data, context.userId, context.supabase as never);
  });

const SaveDocInput = z.object({
  title: z.string().min(1).max(400),
  filename: z.string().min(1).max(400),
  mime_type: z.string().max(200).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  full_text: z.string().min(1).max(200_000),
});

export const saveDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveDocInput.parse(d))
  .handler(async ({ data, context }) => {
    const excerpt = data.full_text.slice(0, 600);
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        user_id: context.userId,
        title: data.title,
        filename: data.filename,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        excerpt,
        full_text: data.full_text,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const listAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("analyses")
      .select("id, title, document_ids, reliability, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("analyses")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Analysis not found");
    return row;
  });

export const reanalyzeAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("analyses")
      .select("title, document_ids")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Analysis not found");
    const docIds = (row.document_ids as string[]) ?? [];
    if (docIds.length === 0) throw new Error("Original documents are unavailable for reanalysis");
    const { data: docs, error: dErr } = await context.supabase
      .from("documents")
      .select("title, full_text")
      .in("id", docIds);
    if (dErr) throw new Error(dErr.message);
    if (!docs || docs.length === 0) throw new Error("Source documents not found");
    return runAnalysisPipeline(
      {
        title: row.title as string,
        papers: docs
          .filter((d): d is { title: string; full_text: string } => !!d.full_text)
          .map((d) => ({ title: d.title, text: d.full_text })),
        documentIds: docIds,
      },
      context.userId,
      context.supabase as never,
    );
  });

const AskInput = z.object({
  id: z.string().uuid(),
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

export const askAboutAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    const { callLovableAI } = await import("./ai-gateway.server");
    const { data: row, error } = await context.supabase
      .from("analyses")
      .select("title, document_ids, gaps, reliability, graph")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Analysis not found");

    const docIds = (row.document_ids as string[]) ?? [];
    let docsContext = "";
    if (docIds.length) {
      const { data: docs } = await context.supabase
        .from("documents")
        .select("title, full_text")
        .in("id", docIds);
      docsContext = (docs ?? [])
        .map(
          (d: { title: string; full_text: string | null }) =>
            `=== ${d.title} ===\n${(d.full_text ?? "").slice(0, 15_000)}`,
        )
        .join("\n\n");
    }

    const analysisContext = JSON.stringify(
      {
        reliability: row.reliability,
        gaps: row.gaps,
        openalex: (row.graph as { openalex?: unknown } | null)?.openalex,
      },
      null,
      2,
    ).slice(0, 30_000);

    const system = `You are TruthLens, a scientific reviewer assistant. Answer questions about the
analyzed paper(s) using ONLY the provided paper text, the TruthLens analysis output, and the
OpenAlex evidence. Be concise, evidence-based, and honest about uncertainty. NEVER invent
citations. If something is not in the provided context, say so.`;

    const convo = data.history
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const user = `PAPER(S):
${docsContext || "(no source text available)"}

TRUTHLENS ANALYSIS (JSON):
${analysisContext}

${convo ? `CONVERSATION SO FAR:\n${convo}\n\n` : ""}User: ${data.question}

Answer:`;

    const reply = await callLovableAI({ system, user, maxTokens: 1200 });
    return { reply: reply.trim() };
  });


export const deleteAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("analyses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

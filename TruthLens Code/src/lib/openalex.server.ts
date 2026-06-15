// OpenAlex client (no API key required; uses polite-pool email).
// Docs: https://docs.openalex.org

const BASE = "https://api.openalex.org";

export interface OpenAlexPaper {
  id: string;
  title: string;
  year: number | null;
  citations: number;
  authors: string[];
  venue: string | null;
  doi: string | null;
  url: string;
  abstract: string;
  concepts: string[];
  type: string | null;
  is_retracted: boolean;
  is_review: boolean;
}

function reconstructAbstract(inv: Record<string, number[]> | null | undefined): string {
  if (!inv) return "";
  const positions: Array<[number, string]> = [];
  for (const [word, idxs] of Object.entries(inv)) {
    for (const i of idxs) positions.push([i, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map(([, w]) => w).join(" ").slice(0, 1200);
}

interface RawWork {
  id?: string;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  cited_by_count?: number;
  doi?: string | null;
  type?: string | null;
  is_retracted?: boolean;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  concepts?: Array<{ display_name?: string; level?: number }>;
}

function normalize(w: RawWork): OpenAlexPaper {
  const type = w.type ?? null;
  const titleStr = (w.title ?? w.display_name ?? "Untitled");
  const isReview =
    type === "review" ||
    type === "meta-analysis" ||
    /\b(review|meta[- ]analys[ie]s|systematic review)\b/i.test(titleStr);
  return {
    id: w.id ?? "",
    title: titleStr.slice(0, 300),
    year: w.publication_year ?? null,
    citations: w.cited_by_count ?? 0,
    authors: (w.authorships ?? [])
      .map((a) => a.author?.display_name)
      .filter((n): n is string => !!n)
      .slice(0, 6),
    venue: w.primary_location?.source?.display_name ?? null,
    doi: w.doi ?? null,
    url: w.doi ? `https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//, "")}` : (w.id ?? ""),
    abstract: reconstructAbstract(w.abstract_inverted_index),
    concepts: (w.concepts ?? [])
      .filter((c) => (c.level ?? 0) <= 2)
      .map((c) => c.display_name ?? "")
      .filter(Boolean)
      .slice(0, 6),
    type,
    is_retracted: !!w.is_retracted,
    is_review: isReview,
  };
}

interface SearchOpts {
  perPage?: number;
  sort?: "relevance_score:desc" | "cited_by_count:desc" | "publication_date:desc";
  /** Extra OpenAlex filter expression appended with comma. */
  filter?: string;
}

async function rawSearch(query: string, opts: SearchOpts = {}): Promise<OpenAlexPaper[]> {
  const q = query.trim().slice(0, 400);
  if (!q) return [];
  const email = process.env.OPENALEX_EMAIL || "research@truthlens.app";
  const url = new URL(`${BASE}/works`);
  url.searchParams.set("search", q);
  url.searchParams.set("per-page", String(opts.perPage ?? 10));
  url.searchParams.set("sort", opts.sort ?? "relevance_score:desc");
  const baseFilter = "type:article|review|book-chapter,is_paratext:false";
  url.searchParams.set(
    "filter",
    opts.filter ? `${baseFilter},${opts.filter}` : baseFilter,
  );
  url.searchParams.set("mailto", email);

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": `TruthLens (mailto:${email})` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: RawWork[] };
    return (data.results ?? []).map(normalize);
  } catch {
    return [];
  }
}

export interface EvidenceCorpus {
  topRelevant: OpenAlexPaper[];
  topCited: OpenAlexPaper[];
  recent: OpenAlexPaper[];
  reviews: OpenAlexPaper[];
  retractionHits: OpenAlexPaper[];
  /** Deduplicated union, ordered: reviews → top-cited → top-relevant → recent. */
  combined: OpenAlexPaper[];
}

/**
 * Multi-strategy retrieval:
 *  - top relevance to keyword query
 *  - top cited (all time) for the query
 *  - recent (last 4 years)
 *  - explicit reviews / meta-analyses
 *  - retraction sweep using title + is_retracted:true
 */
export async function gatherEvidence(
  keywordQuery: string,
  paperTitle: string,
): Promise<EvidenceCorpus> {
  const recentFrom = `${new Date().getFullYear() - 4}-01-01`;
  const [topRelevant, topCited, recent, reviews, retractionHits] = await Promise.all([
    rawSearch(keywordQuery, { perPage: 20, sort: "relevance_score:desc" }),
    rawSearch(keywordQuery, { perPage: 10, sort: "cited_by_count:desc" }),
    rawSearch(keywordQuery, {
      perPage: 8,
      sort: "publication_date:desc",
      filter: `from_publication_date:${recentFrom}`,
    }),
    rawSearch(`${keywordQuery} review meta-analysis`, {
      perPage: 8,
      sort: "cited_by_count:desc",
      filter: "type:review",
    }),
    rawSearch(paperTitle, {
      perPage: 5,
      sort: "relevance_score:desc",
      filter: "is_retracted:true",
    }),
  ]);

  const seen = new Set<string>();
  const combined: OpenAlexPaper[] = [];
  const push = (arr: OpenAlexPaper[]) => {
    for (const p of arr) {
      const key = p.id || p.doi || p.title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      combined.push(p);
    }
  };
  // Hierarchy: reviews/meta-analyses first, then highly-cited, then top-relevant, then recent.
  push(reviews);
  push(topCited);
  push(topRelevant);
  push(recent);

  return { topRelevant, topCited, recent, reviews, retractionHits, combined };
}

/** Compact projection for Gemini context. Tags review/meta and retraction. */
export function toEvidenceLine(p: OpenAlexPaper, idx: number): string {
  const tags: string[] = [];
  if (p.is_review) tags.push("REVIEW/META");
  if (p.is_retracted) tags.push("RETRACTED");
  if (p.type && !p.is_review) tags.push(p.type);
  const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
  return `[E${idx + 1}] "${p.title}" (${p.year ?? "n.d."}, ${p.citations} citations)${tagStr}${
    p.venue ? ` — ${p.venue}` : ""
  }\n  id: ${p.id}\n  abstract: ${p.abstract || "(no abstract)"}`;
}

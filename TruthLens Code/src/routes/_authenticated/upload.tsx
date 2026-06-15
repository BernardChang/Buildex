import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload as UploadIcon,
  FileText,
  X,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Lightbulb,
  Sparkles,
  Zap,
  Telescope,
  FlaskConical,
} from "lucide-react";

import { analyzeAndStore, saveDocument } from "@/lib/analyze.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  usePreferences,
  type AnalysisDepth,
  type AnalysisType,
} from "@/lib/preferences";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload — TruthLens" }] }),
  component: UploadPage,
});

interface Prepared {
  file: File;
  title: string;
  text: string;
}

const LOADING_STEPS = [
  "Reading uploaded paper…",
  "Extracting main claims…",
  "Checking methodology…",
  "Searching OpenAlex, Semantic Scholar, and CrossRef…",
  "Comparing related papers…",
  "Identifying contradictions…",
  "Finding research gaps…",
  "Building reliability score…",
];

function UploadPage() {
  const navigate = useNavigate();
  const { prefs } = usePreferences();
  const analyze = useServerFn(analyzeAndStore);
  const save = useServerFn(saveDocument);

  const guided = prefs.modules.guidedUpload;
  const showSmartLoading = prefs.modules.smartLoading;

  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<Prepared[]>([]);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  const [analysisType, setAnalysisType] = useState<AnalysisType>(prefs.defaultAnalysisType);
  const [depth, setDepth] = useState<AnalysisDepth>(prefs.defaultDepth);

  const [activeStep, setActiveStep] = useState(0);

  const totalSteps = guided ? 4 : 1;

  const onFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const list = Array.from(incoming).slice(0, 8);
      const prepared: Prepared[] = [];
      for (const file of list) {
        try {
          setExtracting(`Extracting ${file.name}…`);
          const { extractText } = await import("@/lib/pdf-extract");
          const text = await extractText(file);
          if (!text.trim()) {
            toast.error(`No text could be extracted from ${file.name}`);
            continue;
          }
          prepared.push({
            file,
            title: file.name.replace(/\.[^.]+$/, ""),
            text,
          });
        } catch (e) {
          toast.error(`Failed to read ${file.name}: ${e instanceof Error ? e.message : ""}`);
        }
      }
      setExtracting("");
      setFiles((cur) => [...cur, ...prepared].slice(0, 8));
    },
    [],
  );

  const runAnalysis = useCallback(async () => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setActiveStep(0);
    try {
      const docIds: string[] = [];
      for (const f of files) {
        const res = await save({
          data: {
            title: f.title,
            filename: f.file.name,
            mime_type: f.file.type || undefined,
            size_bytes: f.file.size,
            full_text: f.text.slice(0, 200_000),
          },
        });
        docIds.push(res.id);
      }
      const result = await analyze({
        data: {
          title: files.length === 1 ? files[0].title : `${files.length} papers`,
          papers: files.map((f) => ({ title: f.title, text: f.text })),
          documentIds: docIds,
        },
      });
      toast.success("Analysis complete");
      navigate({ to: "/results/$id", params: { id: result.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }, [files, busy, save, analyze, navigate]);

  // Auto-run from the wizard's last step (and from autoRun preference once files exist)
  const autoRunTriggered = useRef(false);
  useEffect(() => {
    if (
      prefs.autoRun &&
      !autoRunTriggered.current &&
      files.length > 0 &&
      !busy
    ) {
      autoRunTriggered.current = true;
      runAnalysis();
    }
  }, [prefs.autoRun, files.length, busy, runAnalysis]);

  // Animate the smart-loading checklist while busy
  useEffect(() => {
    if (!busy || !showSmartLoading) return;
    const id = window.setInterval(() => {
      setActiveStep((s) => (s < LOADING_STEPS.length - 1 ? s + 1 : s));
    }, 1400);
    return () => window.clearInterval(id);
  }, [busy, showSmartLoading]);

  // ---------- Loading takeover ----------
  if (busy) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Analyzing
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          TruthLens is reading your {files.length > 1 ? "papers" : "paper"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This usually takes 20–60 seconds depending on depth.
        </p>

        {showSmartLoading ? (
          <div className="mt-10 space-y-3 rounded-2xl border border-border bg-card p-6 tlx-pop">
            {LOADING_STEPS.map((label, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              return (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-3 text-sm transition-opacity duration-300",
                    !done && !active && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary"
                          : "border-border",
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" />
                    ) : active ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                  </span>
                  <span className={cn(done && "text-muted-foreground line-through")}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
          </div>
        )}
      </div>
    );
  }

  // ---------- Non-guided fallback ----------
  if (!guided) {
    return (
      <div className="mx-auto max-w-3xl">
        <Header step={1} total={1} title="Upload your papers" />
        <Dropzone
          dragOver={dragOver}
          setDragOver={setDragOver}
          onFiles={onFiles}
          extracting={extracting}
        />
        <FileList files={files} setFiles={setFiles} />
        {files.length > 0 && (
          <Button size="lg" className="mt-6 w-full" onClick={runAnalysis}>
            Analyze {files.length} paper{files.length > 1 ? "s" : ""}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // ---------- Guided wizard ----------
  const canNext =
    (step === 0 && files.length > 0) ||
    step === 1 ||
    step === 2 ||
    step === 3;

  return (
    <div className="mx-auto max-w-3xl">
      <Stepper step={step} total={totalSteps} />

      <div className="mt-8 tlx-pop">
        {step === 0 && (
          <>
            <Header step={1} total={totalSteps} title="Upload your paper" subtitle="PDF, DOCX, or TXT. Up to 8 documents per analysis." />
            <Dropzone
              dragOver={dragOver}
              setDragOver={setDragOver}
              onFiles={onFiles}
              extracting={extracting}
            />
            <FileList files={files} setFiles={setFiles} />
          </>
        )}

        {step === 1 && (
          <>
            <Header step={2} total={totalSteps} title="Choose analysis type" subtitle="Pick what TruthLens should focus on." />
            <ChoiceGrid
              value={analysisType}
              onChange={setAnalysisType}
              options={[
                {
                  value: "reliability",
                  icon: ShieldCheck,
                  label: "Reliability Check",
                  desc: "Score methodology, evidence strength, bias, and external validation.",
                },
                {
                  value: "gaps",
                  icon: Lightbulb,
                  label: "Research Gap Finder",
                  desc: "Surface unanswered questions and future research directions.",
                },
                {
                  value: "full",
                  icon: Sparkles,
                  label: "Full Analysis",
                  desc: "Everything — reliability, gaps, evidence, and knowledge graph.",
                },
              ]}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Header step={3} total={totalSteps} title="Choose depth" subtitle="Trade speed for thoroughness." />
            <ChoiceGrid
              value={depth}
              onChange={setDepth}
              options={[
                {
                  value: "quick",
                  icon: Zap,
                  label: "Quick Scan",
                  desc: "Fast pass focused on internal quality. ~15–20s.",
                },
                {
                  value: "standard",
                  icon: Telescope,
                  label: "Standard Review",
                  desc: "Balanced — internal + external literature comparison.",
                },
                {
                  value: "deep",
                  icon: FlaskConical,
                  label: "Deep Research Mode",
                  desc: "Wider literature sweep, more comparison papers.",
                },
              ]}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Header step={4} total={totalSteps} title="Ready to run" subtitle="Review your setup, then start the analysis." />
            <div className="mt-6 space-y-2 rounded-2xl border border-border bg-card p-6">
              <ReviewRow label="Papers" value={`${files.length} document${files.length === 1 ? "" : "s"}`} />
              <ReviewRow label="Analysis type" value={analysisTypeLabel(analysisType)} />
              <ReviewRow label="Depth" value={depthLabel(depth)} />
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {step < totalSteps - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={files.length === 0} onClick={runAnalysis}>
            Run analysis <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Pieces --------------------------------- */

function Header({
  step,
  total,
  title,
  subtitle,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Step {step} of {total}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= step ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function Dropzone({
  dragOver,
  setDragOver,
  onFiles,
  extracting,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFiles: (files: FileList | File[]) => void;
  extracting: string;
}) {
  return (
    <>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card p-16 text-center transition-all duration-200",
          dragOver
            ? "border-primary bg-accent shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-primary)_15%,transparent)] scale-[1.01]"
            : "border-border hover:border-foreground",
        )}
      >
        <UploadIcon
          className={cn(
            "h-7 w-7 transition-colors",
            dragOver ? "text-primary" : "text-muted-foreground",
          )}
        />
        <div className="text-base font-medium">
          {dragOver ? "Drop to upload" : "Drop files here"}
        </div>
        <div className="text-xs text-muted-foreground">or click to browse</div>
        <input
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,text/plain"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
      </label>

      {extracting && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {extracting}
        </div>
      )}
    </>
  );
}

function FileList({
  files,
  setFiles,
}: {
  files: Prepared[];
  setFiles: React.Dispatch<React.SetStateAction<Prepared[]>>;
}) {
  if (files.length === 0) return null;
  return (
    <div className="mt-6 space-y-2">
      {files.map((f, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 tlx-lift"
        >
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{f.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {(f.file.size / 1024).toFixed(0)} KB · {f.text.length.toLocaleString()} chars
              </div>
            </div>
          </div>
          <button
            onClick={() => setFiles(files.filter((_, j) => j !== i))}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground tlx-tap"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface Choice<T extends string> {
  value: T;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}

function ChoiceGrid<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Choice<T>[];
}) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-1">
      {options.map(({ value: v, icon: Icon, label, desc }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "group flex items-start gap-4 rounded-2xl border bg-card p-5 text-left transition-all tlx-lift tlx-tap",
              active
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-foreground/30",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{label}</div>
                {active && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                    Selected
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
            </div>
            <div
              className={cn(
                "mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                active ? "border-primary bg-primary" : "border-border",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function analysisTypeLabel(t: AnalysisType) {
  return t === "reliability"
    ? "Reliability Check"
    : t === "gaps"
      ? "Research Gap Finder"
      : "Full Analysis";
}

function depthLabel(d: AnalysisDepth) {
  return d === "quick" ? "Quick Scan" : d === "standard" ? "Standard Review" : "Deep Research Mode";
}

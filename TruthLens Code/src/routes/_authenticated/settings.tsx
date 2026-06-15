import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Monitor, Sun, Moon, RotateCcw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  usePreferences,
  type Accent,
  type AnalysisDepth,
  type AnalysisType,
  type Density,
  type Theme,
} from "@/lib/preferences";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — TruthLens" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { prefs, set, setModule, reset } = usePreferences();
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Preferences
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize how TruthLens looks and behaves. Saved to this browser.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Account */}
      <Section title="Account">
        <Row label="Signed in as" value={email || "—"} />
        <Row label="AI provider" value="Lovable AI · Gemini" />
        <Row label="Evidence sources" value="OpenAlex · Semantic Scholar · CrossRef" />
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Field
          label="Theme"
          description="Match the system or lock to a single mode."
        >
          <SegmentedTheme value={prefs.theme} onChange={(v) => set("theme", v)} />
        </Field>

        <Field label="Accent color" description="Used for highlights, focus rings, and primary buttons.">
          <AccentPicker value={prefs.accent} onChange={(v) => set("accent", v)} />
        </Field>

        <Field label="Density" description="Tighten spacing across the app.">
          <Segmented<Density>
            value={prefs.density}
            onChange={(v) => set("density", v)}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </Field>

        <Toggle
          label="Reduce motion"
          description="Disable lift, pop, and hover translations."
          checked={prefs.reduceMotion}
          onChange={(v) => set("reduceMotion", v)}
        />
      </Section>

      {/* Analysis defaults */}
      <Section title="Analysis defaults">
        <Field label="Default analysis type" description="What to run when you upload a paper.">
          <Segmented<AnalysisType>
            value={prefs.defaultAnalysisType}
            onChange={(v) => set("defaultAnalysisType", v)}
            options={[
              { value: "reliability", label: "Reliability" },
              { value: "gaps", label: "Gap Finder" },
              { value: "full", label: "Full Analysis" },
            ]}
          />
        </Field>

        <Field label="Default depth" description="Trade speed for thoroughness.">
          <Segmented<AnalysisDepth>
            value={prefs.defaultDepth}
            onChange={(v) => set("defaultDepth", v)}
            options={[
              { value: "quick", label: "Quick Scan" },
              { value: "standard", label: "Standard" },
              { value: "deep", label: "Deep Research" },
            ]}
          />
        </Field>

        <Toggle
          label="Auto-run after upload"
          description="Skip the wizard and start analysis immediately."
          checked={prefs.autoRun}
          onChange={(v) => set("autoRun", v)}
        />
      </Section>

      {/* Interface modules */}
      <Section title="Interface modules">
        <p className="-mt-2 mb-2 text-xs text-muted-foreground">
          Turn entire panels on or off across the app.
        </p>
        <Toggle
          label="Guided upload flow"
          description="Step-by-step wizard instead of a plain dropzone."
          checked={prefs.modules.guidedUpload}
          onChange={(v) => setModule("guidedUpload", v)}
        />
        <Toggle
          label="Smart loading messages"
          description="Show what the system is doing during analysis."
          checked={prefs.modules.smartLoading}
          onChange={(v) => setModule("smartLoading", v)}
        />
        <Toggle
          label="Score breakdown"
          description="Expandable rows for every scoring category."
          checked={prefs.modules.scoreBreakdown}
          onChange={(v) => setModule("scoreBreakdown", v)}
        />
        <Toggle
          label="External evidence panel"
          description="Compared-against-the-literature card."
          checked={prefs.modules.externalEvidence}
          onChange={(v) => setModule("externalEvidence", v)}
        />
        <Toggle
          label="Research gap cards"
          description="Detailed actionable gap cards."
          checked={prefs.modules.gapCards}
          onChange={(v) => setModule("gapCards", v)}
        />
        <Toggle
          label="Key claims panel"
          description="Extracted claims with evidence status."
          checked={prefs.modules.keyClaims}
          onChange={(v) => setModule("keyClaims", v)}
        />
        <Toggle
          label="Knowledge graph"
          description="Visual map of paper relationships."
          checked={prefs.modules.knowledgeGraph}
          onChange={(v) => setModule("knowledgeGraph", v)}
        />
        <Toggle
          label="Side assistant"
          description="Conversational follow-up panel on results."
          checked={prefs.modules.sideAssistant}
          onChange={(v) => setModule("sideAssistant", v)}
        />
      </Section>

      {/* Language */}
      <Section title="Language">
        <Toggle
          label="Plain-English mode"
          description="Rewrite verdicts and explanations in simpler language."
          checked={prefs.plainEnglish}
          onChange={(v) => set("plainEnglish", v)}
        />
      </Section>
    </div>
  );
}

/* ----------------------------- Building blocks ----------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Field label={label} description={description}>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-background p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors tlx-tap",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SegmentedTheme({ value, onChange }: { value: Theme; onChange: (v: Theme) => void }) {
  const opts: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-background p-0.5">
      {opts.map(({ value: v, label, icon: Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors tlx-tap",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "slate", label: "Slate", swatch: "oklch(0.13 0 0)" },
  { value: "blue", label: "Blue", swatch: "oklch(0.55 0.2 255)" },
  { value: "violet", label: "Violet", swatch: "oklch(0.55 0.22 295)" },
  { value: "emerald", label: "Emerald", swatch: "oklch(0.6 0.16 160)" },
];

function AccentPicker({ value, onChange }: { value: Accent; onChange: (v: Accent) => void }) {
  return (
    <div className="flex items-center gap-2">
      {ACCENTS.map((a) => {
        const active = a.value === value;
        return (
          <button
            key={a.value}
            type="button"
            onClick={() => onChange(a.value)}
            aria-label={a.label}
            title={a.label}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-all tlx-tap",
              active
                ? "border-foreground scale-110"
                : "border-border hover:border-foreground/60",
            )}
            style={{ background: a.swatch }}
          />
        );
      })}
    </div>
  );
}

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Sparkles, Send, Save, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button, Textarea } from "../components";
import { aiDraftReport, getReport, rolloverWeek, saveReport, submitReport } from "../api/planner";
import { weekLabel } from "./status";

export function ReportsView({ weekStart, t }: { weekStart: string; t: (k: string) => string }) {
  const [completed, setCompleted] = useState("");
  const [progress, setProgress] = useState("");
  const [nextWeek, setNextWeek] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "info" | "warn" | "ok"; text: string } | null>(null);

  const reload = useCallback(async () => {
    setBanner(null);
    try {
      const r = await getReport(weekStart);
      setCompleted(r.completed_summary ?? "");
      setProgress(r.progress_summary ?? "");
      setNextWeek(r.next_week_plan ?? "");
      setSubmitted(r.status === "submitted");
      setAiGenerated(r.ai_generated);
    } catch {
      setBanner({ kind: "warn", text: t("api_down") });
    }
  }, [weekStart, t]);

  useEffect(() => { void reload(); }, [reload]);

  const body = () => ({ completed_summary: completed, progress_summary: progress, next_week_plan: nextWeek });

  async function onDraft() {
    setDrafting(true);
    setBanner(null);
    try {
      const r = await aiDraftReport(weekStart);
      if (!r.available) {
        setBanner({ kind: "warn", text: r.note ?? t("ai_unavailable") });
      } else {
        if (r.completed_summary) setCompleted(r.completed_summary);
        if (r.progress_summary) setProgress(r.progress_summary);
        if (r.next_week_plan) setNextWeek(r.next_week_plan);
        setAiGenerated(true);
        setBanner({ kind: "info", text: `${t("ai_draft")} ✓` });
      }
    } catch {
      setBanner({ kind: "warn", text: t("api_down") });
    } finally {
      setDrafting(false);
    }
  }

  async function onSave() {
    setBusy(true);
    try { await saveReport(weekStart, body()); setBanner({ kind: "ok", text: t("save_draft") + " ✓" }); }
    catch { setBanner({ kind: "warn", text: t("api_down") }); }
    finally { setBusy(false); }
  }

  async function onSubmit() {
    setBusy(true);
    try { await submitReport(weekStart, body()); setSubmitted(true); setBanner({ kind: "ok", text: t("submitted") + " ✓" }); }
    catch { setBanner({ kind: "warn", text: t("api_down") }); }
    finally { setBusy(false); }
  }

  async function onRollover() {
    setBusy(true);
    try {
      const r = await rolloverWeek(weekStart);
      setBanner({ kind: "ok", text: r.created > 0 ? t("rolled_over").replace("{n}", String(r.created)) : t("nothing_to_roll") });
    } catch { setBanner({ kind: "warn", text: t("api_down") }); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={headerRow}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("weekly_report")}</h2>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{weekLabel(weekStart)}</div>
        </div>
        <span style={submitted ? pillDone : pillDraft}>
          {submitted ? <><CheckCircle2 size={12} /> {t("submitted")}</> : t("draft_status")}
          {aiGenerated && !submitted ? " · AI" : ""}
        </span>
      </div>

      {banner && <div style={bannerStyle(banner.kind)}>{banner.text}</div>}
      {submitted && <div style={bannerStyle("info")}>{t("report_submitted_note")}</div>}

      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        <Button variant="secondary" icon={<Sparkles size={15} />} onClick={onDraft} disabled={submitted || drafting}>
          {drafting ? t("drafting") : t("ai_draft")}
        </Button>
        <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={onRollover} disabled={busy}>
          {t("rollover")}
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Textarea label={t("completed_summary")} value={completed} onChange={setCompleted} rows={4} />
        <Textarea label={t("progress_summary")} value={progress} onChange={setProgress} rows={3} />
        <Textarea label={t("next_week_plan")} value={nextWeek} onChange={setNextWeek} rows={3} />
      </div>

      <div style={footer}>
        <Button variant="ghost" icon={<Save size={15} />} onClick={onSave} disabled={submitted || busy}>
          {t("save_draft")}
        </Button>
        <Button variant="primary" icon={<Send size={15} />} onClick={onSubmit} disabled={submitted || busy}>
          {t("submit_report")}
        </Button>
      </div>
    </div>
  );
}

const headerRow: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between" };
const footer: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" };
const pillBase: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: "var(--radius-full)", textTransform: "uppercase", letterSpacing: "0.04em" };
const pillDraft: CSSProperties = { ...pillBase, background: "var(--color-slate-100)", color: "var(--text-tertiary)" };
const pillDone: CSSProperties = { ...pillBase, background: "var(--status-pass-bg)", color: "var(--status-pass)" };

function bannerStyle(kind: "info" | "warn" | "ok"): CSSProperties {
  const map = {
    info: { bg: "var(--color-accent-tint)", fg: "var(--color-accent-deep)", bd: "var(--color-accent)" },
    ok: { bg: "var(--status-pass-bg)", fg: "var(--status-pass)", bd: "var(--status-pass)" },
    warn: { bg: "var(--status-fail-bg)", fg: "var(--status-fail)", bd: "var(--status-fail-border)" },
  }[kind];
  return { fontSize: 12, color: map.fg, background: map.bg, border: `1px solid ${map.bd}`, borderRadius: "var(--radius-md)", padding: "8px 12px", marginTop: 10 };
}

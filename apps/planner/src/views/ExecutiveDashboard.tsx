import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Sparkles, Users, FileCheck2, TrendingUp, AlertTriangle, Eye } from "lucide-react";
import { Button } from "../components";
import { getExecInsights, getExecTelemetry } from "../api/planner";
import type { ExecInsight, ExecTelemetry, Lang } from "../types/models";
import { dayLabel } from "../i18n";
import { weekLabel } from "./status";

export function ExecutiveDashboard({ weekStart, lang, t }: { weekStart: string; lang: Lang; t: (k: string) => string }) {
  const [tele, setTele] = useState<ExecTelemetry | null>(null);
  const [insight, setInsight] = useState<ExecInsight | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    setInsight(null);
    try {
      setTele(await getExecTelemetry(weekStart));
    } catch {
      setTele(null);
      setErr(t("api_down"));
    }
  }, [weekStart, t]);

  useEffect(() => { void reload(); }, [reload]);

  async function runAnalysis() {
    setAnalyzing(true);
    try { setInsight(await getExecInsights(weekStart)); }
    catch { setErr(t("api_down")); }
    finally { setAnalyzing(false); }
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("exec_overview")}</h2>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{weekLabel(weekStart)}</div>
      </div>
      {err && <div style={warnBox}>{err}</div>}

      {tele && (
        <>
          <div style={kpiRow}>
            <Kpi v={`${tele.completion}%`} l={t("completion")} c="var(--status-pass)" />
            <Kpi v={tele.total} l={t("total")} c="var(--text-primary)" />
            <Kpi v={tele.headcount} l={t("headcount")} icon={<Users size={14} />} c="var(--status-review)" />
            <Kpi v={tele.by_status.stuck ?? 0} l={t("stuck")} c="var(--status-fail)" />
            <Kpi v={tele.reports_submitted} l={t("reports_in")} icon={<FileCheck2 size={14} />} c="var(--color-accent-deep)" />
            <Kpi v={tele.busiest_day ? dayLabel(tele.busiest_day, lang) : "—"} l={t("busiest")} c="var(--status-pending)" />
          </div>

          <div style={twoCol}>
            <Panel title={t("by_department")}>
              {tele.by_department.map((d) => (
                <BarRow key={d.dept_id} label={lang === "mk" ? d.name_mk : d.name_en}
                  pct={d.completion} sub={`${d.done}/${d.total}${d.stuck ? ` · ${d.stuck} ${t("stuck").toLowerCase()}` : ""}`} />
              ))}
              {tele.by_department.length === 0 && <Empty t={t} />}
            </Panel>
            <Panel title={t("by_person")}>
              {tele.by_user.map((u) => (
                <BarRow key={u.user_id} label={u.user_name} pct={u.completion} sub={`${u.done}/${u.total}`} />
              ))}
              {tele.by_user.length === 0 && <Empty t={t} />}
            </Panel>
          </div>
        </>
      )}

      <div style={aiCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t("ai_analysis")}</span>
          </div>
          <Button variant="primary" size="sm" icon={<Sparkles size={14} />} onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? t("analyzing") : t("run_analysis")}
          </Button>
        </div>

        {!insight && <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{t("no_insight_yet")}</div>}

        {insight && !insight.available && <div style={warnBox}>{insight.note}</div>}

        {insight && insight.available && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {insight.summary && <p style={{ fontSize: 13, lineHeight: 1.6 }}>{insight.summary}</p>}
            {insight.highlights.length > 0 && <InsightList icon={<TrendingUp size={13} />} title={t("highlights")} items={insight.highlights} color="var(--status-pass)" />}
            {insight.risks.length > 0 && <InsightList icon={<AlertTriangle size={13} />} title={t("risks")} items={insight.risks} color="var(--status-fail)" />}
            {insight.foresight && (
              <div>
                <Label icon={<Eye size={13} />} text={t("foresight")} />
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>{insight.foresight}</p>
              </div>
            )}
          </div>
        )}

        {insight && insight.sources.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
            <Label text={`${t("sources")} (${insight.sources.length})`} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
              {insight.sources.map((s) => <span key={s} style={sourceChip}>{s}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ v, l, c, icon }: { v: string | number; l: string; c: string; icon?: ReactNode }) {
  return (
    <div style={kpi}>
      <span style={{ fontSize: 22, fontWeight: 700, color: c, lineHeight: 1.1 }}>{v}</span>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 4 }}>{icon}{l}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={panel}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{children}</div>
    </div>
  );
}

function BarRow({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--text-tertiary)" }}>{pct}% · {sub}</span>
      </div>
      <div style={track}><span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--status-pass)", borderRadius: 999 }} /></div>
    </div>
  );
}

function InsightList({ icon, title, items, color }: { icon: ReactNode; title: string; items: string[]; color: string }) {
  return (
    <div>
      <Label icon={icon} text={title} color={color} />
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{it}</li>)}
      </ul>
    </div>
  );
}

function Label({ icon, text, color }: { icon?: ReactNode; text: string; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: color ?? "var(--text-tertiary)" }}>
      {icon}{text}
    </span>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return <div style={{ fontSize: 12, color: "var(--text-quaternary)" }}>{t("no_tasks")}</div>;
}

const kpiRow: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 };
const kpi: CSSProperties = { flex: "1 1 120px", display: "flex", flexDirection: "column", gap: 4, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "14px 16px" };
const twoCol: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 };
const panel: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 16 };
const track: CSSProperties = { height: 7, background: "var(--color-slate-100)", borderRadius: 999, overflow: "hidden" };
const aiCard: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--color-accent)", borderRadius: "var(--radius-lg)", padding: 18 };
const warnBox: CSSProperties = { fontSize: 12, color: "var(--status-fail)", background: "var(--status-fail-bg)", border: "1px solid var(--status-fail-border)", borderRadius: "var(--radius-md)", padding: "8px 12px", marginBottom: 10 };
const sourceChip: CSSProperties = { fontSize: 10, color: "var(--text-secondary)", background: "var(--color-slate-100)", borderRadius: "var(--radius-full)", padding: "2px 8px" };

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark } from "@/components/ui";
import { AdminTabs } from "@/components/AdminTabs";
import { statusPill } from "@/components/TuitionAdmin";
import { brl, type InvoiceView } from "@/components/Tuition";

type Row = InvoiceView & { userId: string; name: string | null; kind: string; method: string; guardianName: string | null; phone: string | null };
type Finance = {
  month: string;
  monthLabel: string;
  kind: string | null;
  totals: {
    expectedCents: number;
    receivedCents: number;
    pendingCents: number;
    lateCents: number;
    discountCents: number;
    extraCents: number;
    billable: number;
    paidCount: number;
    openCount: number;
    lateCount: number;
    exemptCount: number;
    withDiscount: number;
  };
  history: { month: string; monthLabel: string; expectedCents: number; receivedCents: number }[];
  rows: Row[];
  app: { receivedCents: number; payments: number };
};

const KINDS = [
  { id: "", label: "Todos" },
  { id: "private_class", label: "Private Class" },
  { id: "student_leadership", label: "Student Leadership" },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const currentMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
const shiftMonth = (ym: string, delta: number) => {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "green" | "amber" | "red" }) {
  const bg = tone === "green" ? "#e4ecdf" : tone === "amber" ? "#fff2d6" : tone === "red" ? "#f5e1e4" : "#fbf8f1";
  const fg = tone === "green" ? "#2f4a2a" : tone === "amber" ? "#8a5a00" : tone === "red" ? "#8d2438" : "var(--ink)";
  return (
    <div style={{ flex: "1 1 160px", minWidth: 0, background: bg, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 22, color: fg, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Barras do histórico: esperado (claro) atrás do realizado (escuro), na mesma escala.
function HistoryChart({ history, selected }: { history: Finance["history"]; selected: string }) {
  const max = Math.max(1, ...history.map((h) => Math.max(h.expectedCents, h.receivedCents)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150, borderBottom: "1px solid var(--line)", padding: "0 4px" }}>
        {history.map((h) => {
          const hExp = (h.expectedCents / max) * 100;
          const hRec = (h.receivedCents / max) * 100;
          const on = h.month === selected;
          return (
            <div key={h.month} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }} title={`${h.monthLabel}: esperado ${brl(h.expectedCents)}, realizado ${brl(h.receivedCents)}`}>
              <div style={{ width: "34%", maxWidth: 22, height: `${hExp}%`, background: on ? "#f6d9a0" : "#ece6d6", borderRadius: "4px 4px 0 0" }} />
              <div style={{ width: "34%", maxWidth: 22, height: `${hRec}%`, background: on ? "var(--mustard)" : "var(--sage)", borderRadius: "4px 4px 0 0" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "6px 4px 0" }}>
        {history.map((h) => (
          <div key={h.month} style={{ flex: 1, textAlign: "center", fontSize: 11, color: h.month === selected ? "var(--ink)" : "var(--muted)", fontWeight: h.month === selected ? 700 : 400 }}>
            {h.monthLabel.slice(0, 3)}/{h.monthLabel.slice(-2)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--muted)", marginTop: 8, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#ece6d6", borderRadius: 2, marginRight: 5 }} />Esperado</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--sage)", borderRadius: 2, marginRight: 5 }} />Realizado</span>
      </div>
    </div>
  );
}

export default function FinanceiroPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [allowed, setAllowed] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [kind, setKind] = useState("");
  const [data, setData] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.push("/login");
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!profile?.is_admin) return router.push("/");
      setAllowed(true);
    });
  }, []);

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    fetch(`/api/admin/finance?month=${month}${kind ? `&kind=${kind}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("Não foi possível carregar o financeiro."))
      .finally(() => setLoading(false));
  }, [allowed, month, kind]);

  if (!allowed) return null;
  const t = data?.totals;
  const pct = t && t.expectedCents > 0 ? Math.round((t.receivedCents / t.expectedCents) * 100) : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink-on-dark)", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 22, margin: 0 }}>Financeiro</h1>
            <Spark size={14} style={{ marginTop: -10 }} />
          </div>
          <Button variant="subtle" onClick={() => router.push("/")}>Voltar ao app</Button>
        </div>
        <AdminTabs active="/admin/financeiro" />

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Button variant="subtle" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior">←</Button>
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                aria-label="Mês"
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13.5, fontFamily: "inherit" }}
              />
              <Button variant="subtle" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês">→</Button>
            </div>
            <div role="group" aria-label="Tipo de aluno" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {KINDS.map((k) => {
                const on = kind === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setKind(k.id)}
                    style={{ padding: "6px 12px", borderRadius: 20, border: on ? "1px solid var(--ink)" : "1px solid var(--line)", background: on ? "var(--ink)" : "#fbf8f1", color: on ? "#fff" : "var(--ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {error && <Card style={{ marginBottom: 16 }}><span style={{ color: "var(--wine)" }}>{error}</span></Card>}
        {loading && !data && <Card>Carregando…</Card>}

        {data && t && (
          <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Mensalidades Unblocking Minds · {cap(data.monthLabel)}{data.kind ? ` · ${KINDS.find((k) => k.id === data.kind)?.label}` : ""}</SectionLabel>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <Kpi label="Esperado" value={brl(t.expectedCents)} sub={`${t.billable} ${t.billable === 1 ? "mensalidade" : "mensalidades"}${t.exemptCount ? ` · ${t.exemptCount} isenta${t.exemptCount === 1 ? "" : "s"}` : ""}`} />
                <Kpi label="Realizado" value={brl(t.receivedCents)} sub={`${t.paidCount} de ${t.billable} pagaram${pct !== null ? ` · ${pct}% do esperado` : ""}`} tone="green" />
                <Kpi label="Em aberto" value={brl(t.pendingCents)} sub={`${t.openCount} ${t.openCount === 1 ? "aluno" : "alunos"} (valor cheio)`} tone={t.openCount ? "amber" : undefined} />
                <Kpi label="Em atraso" value={brl(t.lateCents)} sub={`${t.lateCount} ${t.lateCount === 1 ? "aluno" : "alunos"}`} tone={t.lateCount ? "red" : undefined} />
              </div>

              <div aria-label="Realizado sobre esperado" style={{ height: 12, borderRadius: 999, background: "#ece6d6", overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${Math.min(100, pct ?? 0)}%`, height: "100%", background: "var(--sage)", transition: "width .3s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
                <span>Realizado {pct !== null ? `${pct}%` : "—"}</span>
                <span>Falta {brl(Math.max(0, t.expectedCents - t.receivedCents))}</span>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Kpi label="Descontos concedidos" value={brl(t.discountCents)} sub={`${t.withDiscount} ${t.withDiscount === 1 ? "pagamento" : "pagamentos"} com 7%`} />
                <Kpi label="Multa e juros recebidos" value={brl(t.extraCents)} />
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Esperado x realizado · últimos 6 meses</SectionLabel>
              <HistoryChart history={data.history} selected={data.month} />
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Alunos no mês ({data.rows.length})</SectionLabel>
              {data.rows.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma mensalidade neste mês{data.kind ? " para este tipo de aluno" : ""}.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11.5 }}>
                        <th style={{ padding: "0 6px 6px" }}>Aluno</th>
                        <th style={{ padding: "0 6px 6px" }}>Esperado</th>
                        <th style={{ padding: "0 6px 6px" }}>Realizado</th>
                        <th style={{ padding: "0 6px 6px" }}>Situação</th>
                        <th style={{ padding: "0 6px 6px" }}>Contato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => {
                        const wa = r.phone ? `https://wa.me/55${r.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}` : null;
                        return (
                          <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                            <td style={{ padding: "8px 6px" }}>
                              <Link href={`/admin/${r.userId}`} style={{ color: "var(--ink)", fontWeight: 600 }}>{r.name || "(sem nome)"}</Link>
                              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                                {r.kind === "private_class" ? "Private Class" : "Student Leadership"}
                                {r.method === "auto" ? " · débito automático" : ""}
                              </div>
                            </td>
                            <td style={{ padding: "8px 6px" }}>{r.status === "exempt" ? "—" : brl(r.fullCents)}</td>
                            <td style={{ padding: "8px 6px" }}>{r.status === "paid" ? brl(r.paidAmount ?? r.fullCents) : "—"}</td>
                            <td style={{ padding: "8px 6px" }}>{statusPill(r)}</td>
                            <td style={{ padding: "8px 6px", fontSize: 12 }}>
                              {wa && r.status === "open" ? (
                                <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)" }}>
                                  WhatsApp{r.guardianName ? ` · ${r.guardianName.split(" ")[0]}` : ""}
                                </a>
                              ) : (
                                r.guardianName || "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Assinaturas do app +Unblocking · {cap(data.monthLabel)}</SectionLabel>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Kpi label="Receita do mês" value={brl(data.app.receivedCents)} sub={`${data.app.payments} ${data.app.payments === 1 ? "pagamento" : "pagamentos"} · não entra no filtro de tipo`} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

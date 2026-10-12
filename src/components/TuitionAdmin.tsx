"use client";

import React, { useEffect, useState } from "react";
import { Card, Button, SectionLabel, Switch } from "@/components/ui";
import { brl, type InvoiceView } from "@/components/Tuition";

type Plan = {
  active: boolean;
  kind: "private_class" | "student_leadership";
  amount_cents: number;
  due_day: number;
  method: "link" | "auto";
  auto_link: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  guardian_cpf: string | null;
  guardian_token: string | null;
};

const input: React.CSSProperties = { padding: "7px 10px", borderRadius: 3, border: "1px solid var(--line)", fontSize: 13, background: "#fff", width: "100%", boxSizing: "border-box" };
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)", minWidth: 0 };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function statusPill(v: InvoiceView) {
  const base: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" };
  if (v.status === "exempt") return <span style={{ ...base, background: "#eceaf3", color: "var(--muted)" }}>Isento</span>;
  if (v.status === "paid") {
    const how = v.paidHow === "auto" ? "débito" : v.paidHow === "manual" ? "por fora" : "link";
    return <span style={{ ...base, background: "var(--sage)", color: "#fff" }}>Pago {v.paidAt ? new Date(v.paidAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""} · {how}</span>;
  }
  return <span style={{ ...base, background: v.late ? "#f7e1e5" : "#fdf0d6", color: v.late ? "var(--wine)" : "#7a4d05" }}>{v.late ? "Em atraso" : "Em aberto"}</span>;
}

const parseMoney = (s: string) => {
  const v = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? Math.round(v * 100) : NaN;
};
const moneyStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");

// Mensalidade da escola no detalhe do aluno (admin).
export function TuitionAdmin({ userId }: { userId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [f, setF] = useState({
    active: true,
    kind: "private_class" as Plan["kind"],
    amount: "",
    dueDay: 10,
    method: "link" as Plan["method"],
    autoLink: "",
    hasGuardian: false,
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    guardianCpf: "",
  });

  function fill(p: Plan | null) {
    setF({
      active: p?.active ?? true,
      kind: p?.kind ?? "private_class",
      amount: p ? moneyStr(p.amount_cents) : "",
      dueDay: p?.due_day ?? 10,
      method: p?.method ?? "link",
      autoLink: p?.auto_link ?? "",
      hasGuardian: !!p?.guardian_email,
      guardianName: p?.guardian_name ?? "",
      guardianEmail: p?.guardian_email ?? "",
      guardianPhone: p?.guardian_phone ?? "",
      guardianCpf: p?.guardian_cpf ?? "",
    });
  }

  function apply(d: { plan: Plan | null; invoices: InvoiceView[] }) {
    setPlan(d.plan);
    setInvoices(d.invoices || []);
    fill(d.plan);
  }

  useEffect(() => {
    fetch(`/api/admin/students/${userId}/tuition`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        apply(d);
        setEditing(!d.plan);
      })
      .catch(() => setErr("Não foi possível carregar a mensalidade."))
      .finally(() => setLoaded(true));
  }, [userId]);

  async function save() {
    setSaving(true);
    setErr("");
    setMsg("");
    const amountCents = parseMoney(f.amount);
    if (!Number.isFinite(amountCents)) {
      setErr("Informe o valor mensal, por exemplo 450,00.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/students/${userId}/tuition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, amountCents }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha ao salvar");
      apply(d);
      setEditing(false);
      setMsg("Mensalidade salva.");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function act(invoiceId: string, action: string) {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/students/${userId}/tuition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha ao atualizar");
      apply(d);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  const pc = f.kind === "private_class";
  const amountCents = parseMoney(f.amount);
  const guardianLink = plan?.guardian_email && plan.guardian_token ? `${window.location.origin}/mensalidade/${plan.guardian_token}` : null;

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <SectionLabel>Mensalidade Unblocking Minds</SectionLabel>
        {plan && !editing && (
          <Button variant="ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
      </div>

      {!plan && !editing && <div style={{ fontSize: 13, color: "var(--muted)" }}>Sem mensalidade configurada.</div>}

      {plan && !editing && (
        <div style={{ fontSize: 13.5, lineHeight: 1.7, marginBottom: 12 }}>
          <div>
            <b>{plan.kind === "private_class" ? "Private Class" : "Student Leadership"}</b> · {brl(plan.amount_cents)}
            {plan.kind === "private_class" ? ` (${brl(Math.round(plan.amount_cents * 0.93))} até o dia 7) · vence dia 10` : ` · vence dia ${plan.due_day}`}
            {!plan.active && <span style={{ color: "var(--wine)" }}> · cobrança pausada</span>}
          </div>
          <div>{plan.method === "auto" ? "Débito automático InfinitePay (confirmar cada mês aqui)" : "Link do mês (confirmação automática)"}</div>
          {plan.guardian_email ? (
            <div>
              Responsável: {plan.guardian_name} · {plan.guardian_email} · {plan.guardian_phone} · CPF {plan.guardian_cpf}
            </div>
          ) : (
            <div>Paga o próprio aluno, pelo perfil no app.</div>
          )}
          {guardianLink && (
            <div style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
              Página do responsável: <a href={guardianLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)" }}>{guardianLink}</a>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
          <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} labelOn="Cobrança ativa" labelOff="Cobrança pausada" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <label style={field}>
              Tipo de aluno
              <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Plan["kind"] })} style={input}>
                <option value="private_class">Private Class (7% até o dia 7)</option>
                <option value="student_leadership">Student Leadership (sem desconto)</option>
              </select>
            </label>
            <label style={field}>
              Valor mensal (R$)
              <input value={f.amount} inputMode="decimal" placeholder="450,00" onChange={(e) => setF({ ...f, amount: e.target.value })} style={input} />
            </label>
            <label style={field}>
              Vencimento
              {pc ? (
                <input value="Dia 10 (desconto até o dia 7)" disabled style={{ ...input, background: "#f5efe0" }} />
              ) : (
                <select value={f.dueDay} onChange={(e) => setF({ ...f, dueDay: Number(e.target.value) })} style={input}>
                  <option value={10}>Dia 10</option>
                  <option value={21}>Dia 21</option>
                </select>
              )}
            </label>
            <label style={field}>
              Forma de pagamento
              <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as Plan["method"] })} style={input}>
                <option value="link">Link do mês (o app confirma sozinho)</option>
                <option value="auto">Débito automático InfinitePay (Pix ou cartão)</option>
              </select>
            </label>
          </div>
          {pc && Number.isFinite(amountCents) && amountCents > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Até o dia 7: {brl(Math.round(amountCents * 0.93))} · do dia 8 ao 10: {brl(amountCents)} · depois do dia 10: em atraso
            </div>
          )}
          <label style={field}>
            Link de adesão ao débito automático (criado no app da InfinitePay, opcional)
            <input value={f.autoLink} placeholder="https://..." onChange={(e) => setF({ ...f, autoLink: e.target.value })} style={input} />
          </label>
          {f.method === "auto" && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              No débito automático, o app não gera link nem manda cobrança. A InfinitePay não avisa o app sobre esse débito: confirme cada mês abaixo, em "Confirmar débito".
            </div>
          )}

          <Switch checked={f.hasGuardian} onChange={(v) => setF({ ...f, hasGuardian: v })} labelOn="Tem responsável financeiro" labelOff="Sem responsável financeiro" />
          {f.hasGuardian && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <label style={field}>
                  Nome
                  <input value={f.guardianName} onChange={(e) => setF({ ...f, guardianName: e.target.value })} style={input} />
                </label>
                <label style={field}>
                  E-mail
                  <input type="email" value={f.guardianEmail} onChange={(e) => setF({ ...f, guardianEmail: e.target.value })} style={input} />
                </label>
                <label style={field}>
                  Telefone (WhatsApp, com DDD)
                  <input type="tel" inputMode="tel" value={f.guardianPhone} onChange={(e) => setF({ ...f, guardianPhone: e.target.value })} style={input} />
                </label>
                <label style={field}>
                  CPF
                  <input inputMode="numeric" value={f.guardianCpf} onChange={(e) => setF({ ...f, guardianCpf: e.target.value })} style={input} />
                </label>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                Com responsável, a cobrança some do app do aluno e os e-mails vão só para o responsável, com um link de pagamento sem login. O CPF fica só aqui no admin.
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar mensalidade"}</Button>
            {plan && (
              <Button variant="subtle" disabled={saving} onClick={() => { fill(plan); setEditing(false); setErr(""); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {err && <div style={{ fontSize: 13, color: "var(--wine)", marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ fontSize: 13, color: "var(--sage)", marginBottom: 10 }}>{msg}</div>}

      {invoices.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11.5 }}>
                <th style={{ padding: "0 6px 6px" }}>Mês</th>
                <th style={{ padding: "0 6px 6px" }}>Valor</th>
                <th style={{ padding: "0 6px 6px" }}>Situação</th>
                <th style={{ padding: "0 6px 6px", textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((v) => (
                <tr key={v.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 6px" }}>{cap(v.monthLabel)}</td>
                  <td style={{ padding: "8px 6px" }}>{brl(v.status === "paid" ? v.paidAmount ?? v.fullCents : v.status === "open" ? v.priceNowCents : v.fullCents)}</td>
                  <td style={{ padding: "8px 6px" }}>{statusPill(v)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {v.status === "open" ? (
                      <>
                        <Button variant="subtle" disabled={saving} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => act(v.id, plan?.method === "auto" ? "confirm_auto" : "mark_paid")}>
                          {plan?.method === "auto" ? "Confirmar débito" : "Marcar pago"}
                        </Button>{" "}
                        <Button variant="subtle" disabled={saving} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => act(v.id, "exempt")}>
                          Isentar
                        </Button>
                      </>
                    ) : v.paidHow !== "link" ? (
                      <Button variant="subtle" disabled={saving} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => act(v.id, "reopen")}>
                        Reabrir
                      </Button>
                    ) : v.receiptUrl ? (
                      <a href={v.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", fontSize: 12 }}>
                        Comprovante
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

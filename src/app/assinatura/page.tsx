"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, SectionHeading, PhysicalButton, Lockup } from "@/components/ui";

type Payment = { id: string; amount_cents: number; paid_amount: number | null; capture_method: string | null; receipt_url: string | null; paid_at: string };
type PlanInfo = { id: string; label: string; days: number; months: number; priceCents: number; perMonthCents: number; discountPct: number };
type Status = {
  category: string;
  isAdmin: boolean;
  status: string;
  accessUntil: string | null;
  daysLeft: number;
  priceCents: number;
  periodDays: number;
  plans: PlanInfo[];
  payments: Payment[];
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Minha assinatura. Fica fora do guard de acesso de propósito: quem está com
// o teste ou a assinatura vencidos chega aqui pela tela /bloqueado para pagar.
export default function AssinaturaPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [s, setS] = useState<Status | null>(null);
  const [opening, setOpening] = useState(false);
  const [plan, setPlan] = useState("semiannual");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      fetch("/api/billing/status")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setS)
        .catch(() => setError("Não foi possível carregar sua assinatura agora."));
    });
  }, []);

  async function pay() {
    setOpening(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Não foi possível abrir o pagamento agora. Tente de novo.");
      setOpening(false);
    }
  }

  const chosen = s?.plans.find((p) => p.id === plan);
  const included = s && (s.category === "unblocking" || s.isAdmin);
  const ok = s?.status === "ok";
  const statusLine = !s
    ? ""
    : included
      ? "Aluno Unblocking: acesso incluso"
      : s.category === "demo"
        ? ok
          ? `Teste grátis: ${s.daysLeft <= 1 ? "termina hoje" : `faltam ${s.daysLeft} dias`}`
          : "Seu teste grátis acabou"
        : ok
          ? `Assinatura ativa até ${fmt(s.accessUntil!)}`
          : "Sua assinatura venceu";

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink-on-dark)", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Lockup size={20} />
          <button
            onClick={() => (ok ? router.push("/") : router.back())}
            style={{ background: "none", border: "none", color: "var(--muted-on-dark)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}
          >
            ← Voltar
          </button>
        </div>

        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, fontWeight: 600, margin: "6px 0 0" }}>Minha assinatura</h1>
        {s && <div style={{ fontSize: 14.5, color: ok ? "var(--teal)" : "var(--coral)", fontWeight: 600 }}>{statusLine}</div>}

        {s && !included && (
          <Card>
            <SectionHeading>Escolha seu plano</SectionHeading>
            <p style={{ margin: "4px 0 14px", fontSize: 13, color: "var(--muted)" }}>Pague uma vez, sem renovação automática.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {s.plans.map((p) => {
                const sel = p.id === plan;
                const best = p.id === "semiannual";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    aria-pressed={sel}
                    style={{
                      position: "relative",
                      textAlign: "left",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      color: "var(--ink)",
                      borderRadius: 16,
                      padding: best ? "20px 14px 14px" : "14px",
                      border: `${best || sel ? 2 : 1.5}px solid ${best || sel ? "var(--mustard)" : "var(--line)"}`,
                      background: sel ? "#fff8e8" : "#fbf8f1",
                      boxShadow: sel ? "0 0 0 2px rgba(246,160,23,.25)" : "none",
                    }}
                  >
                    {best && (
                      <span style={{ position: "absolute", top: -11, left: 14, background: "var(--mustard)", color: "var(--ink)", fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999 }}>
                        Melhor custo
                      </span>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 15.5 }}>{p.label}</span>
                      {p.discountPct > 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--sage)", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
                          {p.discountPct}% de desconto
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>{p.days} dias</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 2px" }}>
                      <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{brl(p.perMonthCents).replace(",00", "")}</span>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>por mês</span>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Total: <b>{brl(p.priceCents)}</b>
                      {p.months > 1 && (
                        <>
                          {" "}em {p.days} dias <s style={{ color: "var(--muted)", marginLeft: 6 }}>{brl(s.plans[0].priceCents * p.months)}</s>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <ul style={{ margin: "16px 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: "var(--ink)" }}>
              <li>Aulas diárias de leitura, gramática, escuta, fala e escrita</li>
              <li>Correção com feedback no seu nível</li>
              <li>Games e sugestões de conteúdo em inglês</li>
            </ul>
            <PhysicalButton onClick={pay} disabled={opening || !chosen} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
              {opening ? "Abrindo pagamento…" : `${s.category === "app" ? "Renovar" : "Assinar"} ${chosen?.label.toLowerCase()} por ${chosen ? brl(chosen.priceCents) : ""}`}
            </PhysicalButton>
            <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>Pix ou cartão. Taxas da operadora de pagamento podem ser cobradas na operação.</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>
              No cartão, o parcelamento é opcional e as taxas de parcelamento ficam por conta de quem paga. O valor final de cada parcela aparece no checkout, antes de confirmar.
            </p>
            {s.category === "app" && ok && (
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>Renovando agora, os dias novos são somados ao que ainda falta.</p>
            )}
          </Card>
        )}

        {error && <div style={{ fontSize: 13.5, color: "var(--coral)" }}>{error}</div>}

        {s && s.payments.length > 0 && (
          <Card>
            <SectionHeading>Pagamentos</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {s.payments.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, color: "var(--ink)" }}>
                  <span>
                    {fmt(p.paid_at)} · {brl(p.paid_amount ?? p.amount_cents)}
                    {p.capture_method ? ` · ${p.capture_method === "pix" ? "Pix" : "Cartão"}` : ""}
                  </span>
                  {p.receipt_url && /^https:\/\//.test(p.receipt_url) && (
                    <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", fontWeight: 600 }}>
                      Comprovante
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, SectionHeading, PhysicalButton, Lockup } from "@/components/ui";

type Payment = { id: string; amount_cents: number; paid_amount: number | null; capture_method: string | null; receipt_url: string | null; paid_at: string };
type Status = {
  category: string;
  isAdmin: boolean;
  status: string;
  accessUntil: string | null;
  daysLeft: number;
  priceCents: number;
  periodDays: number;
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
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Não foi possível abrir o pagamento agora. Tente de novo.");
      setOpening(false);
    }
  }

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
            <SectionHeading>Plano mensal</SectionHeading>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0 4px" }}>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 34, fontWeight: 700, color: "var(--ink)" }}>{brl(s.priceCents)}</span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>/ {s.periodDays} dias</span>
            </div>
            <ul style={{ margin: "8px 0 16px", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: "var(--ink)" }}>
              <li>Aulas diárias de leitura, gramática, escuta, fala e escrita</li>
              <li>Correção com feedback no seu nível</li>
              <li>Games e sugestões de conteúdo em inglês</li>
              <li>Pix ou cartão. Sem renovação automática: você paga quando quiser continuar</li>
            </ul>
            <PhysicalButton onClick={pay} disabled={opening} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
              {opening ? "Abrindo pagamento…" : s.category === "app" ? "Renovar por mais 30 dias" : "Assinar agora"}
            </PhysicalButton>
            {s.category === "app" && ok && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>Renovando agora, os 30 dias são somados ao que ainda falta.</p>
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

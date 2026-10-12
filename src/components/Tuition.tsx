"use client";

import React, { useEffect, useState } from "react";
import { Card, SectionHeading, PhysicalButton } from "@/components/ui";

// Mensalidade da escola Unblocking Minds: cartão do perfil do aluno, página do
// responsável financeiro e pop-up do desconto na home. Os valores chegam
// prontos do servidor (calculados pela data de Brasília).

export type InvoiceView = {
  id: string;
  month: string;
  monthLabel: string;
  status: "open" | "paid" | "exempt";
  fullCents: number;
  priceNowCents: number;
  discountCents: number | null;
  discountActive: boolean;
  discountUntil: string | null;
  dueDate: string;
  late: boolean;
  daysToDiscountEnd: number | null;
  paidAt: string | null;
  paidAmount: number | null;
  paidHow: "link" | "auto" | "manual" | null;
  receiptUrl: string | null;
};

export type TuitionStateView = {
  kind: "private_class" | "student_leadership";
  method: "link" | "auto";
  autoLink: string | null;
  dueDay: number;
  amountCents: number;
  open: InvoiceView[];
  history: InvoiceView[];
  streak: number;
  savedThisYearCents: number;
};

export const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

const pill = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  background: bg,
  color,
});

function OpenInvoice({ inv, pc, onPay, paying, auto, dueDay }: { inv: InvoiceView; pc: boolean; onPay: () => void; paying: boolean; auto: boolean; dueDay: number }) {
  const status = auto
    ? <span style={pill("#eef2ea", "var(--sage)")}>Débito programado</span>
    : inv.late
      ? <span style={pill("#f7e1e5", "var(--wine)")}>Vencida</span>
      : <span style={pill("#fdf0d6", "#7a4d05")}>{inv.discountActive ? "Em aberto" : `Vence em ${inv.dueDate}`}</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 15 }}>{cap(inv.monthLabel)}</span>
        {status}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{brl(inv.priceNowCents)}</span>
        {inv.discountActive && <s style={{ color: "var(--muted)", fontSize: 14 }}>{brl(inv.fullCents)}</s>}
      </div>
      {auto ? (
        <div style={{ background: "#eef2ea", border: "1.5px solid var(--sage)", borderRadius: 14, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.5 }}>
          <b style={{ color: "var(--sage)" }}>Débito automático ativo.</b> Pix ou cartão, cobrado pela InfinitePay
          {pc ? ` até o dia 7, já com 7% de desconto (${brl(inv.discountCents ?? inv.fullCents)})` : ` todo dia ${dueDay}`}. Não usa o limite do cartão.
        </div>
      ) : (
        <>
          <div
            style={{
              background: inv.discountActive ? "#fff8e8" : "#fbf8f1",
              border: `1.5px solid ${inv.discountActive ? "var(--mustard)" : "var(--line)"}`,
              borderRadius: 14,
              padding: "10px 12px",
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--ink)",
            }}
          >
            {pc && inv.discountActive && (
              <>Pagando até <b>{inv.discountUntil}</b> você tem <b>7% de desconto</b>. Depois disso, o valor é {brl(inv.fullCents)}, com vencimento em {inv.dueDate}.</>
            )}
            {pc && !inv.discountActive && !inv.late && (
              <>O desconto de 7% valia até {inv.discountUntil}. O vencimento é <b>{inv.dueDate}</b>. No mês que vem, pagando até o dia 7, a economia é de {brl(inv.fullCents - (inv.discountCents ?? inv.fullCents))}.</>
            )}
            {!pc && !inv.late && <>Vencimento em <b>{inv.dueDate}</b>.</>}
            {inv.late && <>Venceu em {inv.dueDate}. Você ainda pode pagar por aqui.</>}
          </div>
          <PhysicalButton onClick={onPay} disabled={paying} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
            {paying ? "Abrindo pagamento…" : `Pagar ${inv.monthLabel.split("/")[0]} por ${brl(inv.priceNowCents)}`}
          </PhysicalButton>
        </>
      )}
    </div>
  );
}

export function TuitionCard({
  state,
  onPay,
  payingId,
  error,
  title = "Mensalidade Unblocking Minds",
  intro,
}: {
  state: TuitionStateView;
  onPay: (invoiceId: string) => void;
  payingId: string | null;
  error?: string;
  title?: string;
  intro?: React.ReactNode;
}) {
  const pc = state.kind === "private_class";
  const auto = state.method === "auto";
  return (
    <Card style={{ marginBottom: 14 }}>
      <div id="mensalidade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionHeading>{title}</SectionHeading>
        {intro}
        {state.open.length === 0 && (
          <div style={{ fontSize: 13.5, color: "var(--muted)" }}>Tudo em dia. A próxima mensalidade abre no dia 25.</div>
        )}
        {state.open.map((inv) => (
          <OpenInvoice key={inv.id} inv={inv} pc={pc} auto={auto} dueDay={state.dueDay} paying={payingId === inv.id} onPay={() => onPay(inv.id)} />
        ))}
        {error && <div style={{ fontSize: 13, color: "var(--wine)" }}>{error}</div>}

        {(state.streak > 0 || state.savedThisYearCents > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, color: "var(--sage)", background: "#eef2ea", borderRadius: 12, padding: "9px 12px" }}>
            {state.streak > 0 && <span><b>{state.streak} {state.streak === 1 ? "mês pago" : "meses pagos"}</b> em dia</span>}
            {state.savedThisYearCents > 0 && <span>Economia em {new Date().getFullYear()}: <b>{brl(state.savedThisYearCents)}</b></span>}
          </div>
        )}

        {!auto && state.autoLink && state.open.length > 0 && (
          <div style={{ background: "#eef2ea", border: "1.5px dashed var(--sage)", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, lineHeight: 1.5 }}>
            <b>Prefere não se preocupar todo mês?</b>
            <span>
              Ative o débito automático no Pix ou no cartão. <b style={{ color: "var(--sage)" }}>Não usa o limite do cartão:</b> cada mês é cobrado só o valor da mensalidade.
            </span>
            <a
              href={state.autoLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ alignSelf: "flex-start", background: "var(--sage)", color: "#fff", borderRadius: 12, padding: "9px 14px", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}
            >
              Ativar débito automático
            </a>
          </div>
        )}

        {!auto && state.open.length > 0 && (
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>
            Pix ou cartão. Taxas da operadora de pagamento podem ser cobradas na operação. No cartão, o parcelamento é opcional e as taxas de parcelamento ficam por conta de quem paga.
          </p>
        )}

        {state.history.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Meses anteriores</div>
            {state.history.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {cap(h.monthLabel)}
                  {h.status === "paid" && h.paidAmount ? ` · ${brl(h.paidAmount)}` : ""}
                  {h.status === "paid" && h.paidAt ? ` · pago em ${fmt(h.paidAt)}` : ""}
                </span>
                {h.status === "exempt" ? (
                  <span style={pill("#eceaf3", "var(--muted)")}>Isento</span>
                ) : h.receiptUrl ? (
                  <a href={h.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    Comprovante
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

async function openCheckout(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || "Não foi possível abrir o pagamento agora. Tente de novo.");
  window.location.href = data.url;
}

// Perfil do aluno. Não aparece para quem não tem mensalidade ou tem
// responsável financeiro.
export function StudentTuition() {
  const [state, setState] = useState<TuitionStateView | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tuition/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.show) setState(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state && window.location.hash === "#mensalidade") document.getElementById("mensalidade")?.scrollIntoView({ behavior: "smooth" });
  }, [state]);

  if (!state) return null;
  return (
    <TuitionCard
      state={state}
      payingId={payingId}
      error={error}
      onPay={async (id) => {
        setPayingId(id);
        setError("");
        try {
          await openCheckout("/api/tuition/checkout", { invoiceId: id });
        } catch (e: any) {
          setError(e.message);
          setPayingId(null);
        }
      }}
    />
  );
}

const POPUP_KEY = "tuition-discount-popup";

// Pop-up do desconto de 7% na home: Private Class, pagando pelo link, com
// cobrança em aberto dentro do prazo do desconto. No máximo uma vez por sessão.
export function TuitionPopup() {
  const [inv, setInv] = useState<InvoiceView | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(POPUP_KEY)) return;
    } catch {}
    fetch("/api/tuition/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.show || d.kind !== "private_class" || d.method !== "link") return;
        const target = (d.open as InvoiceView[]).find((i) => i.discountActive);
        if (!target) return;
        try {
          sessionStorage.setItem(POPUP_KEY, "1");
        } catch {}
        setInv(target);
      })
      .catch(() => {});
  }, []);

  if (!inv) return null;
  const mes = inv.monthLabel.split("/")[0];
  const falta =
    inv.daysToDiscountEnd === null ? "" : inv.daysToDiscountEnd === 0 ? " Hoje é o último dia." : inv.daysToDiscountEnd === 1 ? " Falta 1 dia." : ` Faltam ${inv.daysToDiscountEnd} dias.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tuition-pop-title"
      style={{ position: "fixed", inset: 0, background: "rgba(16,20,58,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ background: "#fff", color: "var(--ink)", borderRadius: 20, padding: "22px 20px 14px", maxWidth: 340, width: "100%", display: "flex", flexDirection: "column", gap: 10, textAlign: "center", boxShadow: "0 18px 40px rgba(0,0,0,.25)" }}>
        <span style={{ alignSelf: "center", background: "var(--mustard)", color: "var(--ink)", fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: ".06em", padding: "5px 12px", borderRadius: 999 }}>7% OFF</span>
        <h2 id="tuition-pop-title" style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, margin: 0 }}>Sua mensalidade de {mes} está com desconto</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Pague até <b>{inv.discountUntil}</b> e fica <b>{brl(inv.priceNowCents)}</b> em vez de <s style={{ color: "var(--muted)" }}>{brl(inv.fullCents)}</s>.{falta}
        </p>
        {error && <div style={{ fontSize: 13, color: "var(--wine)" }}>{error}</div>}
        <PhysicalButton
          disabled={paying}
          background="var(--teal)"
          color="var(--ink)"
          shadowColor="var(--mustard)"
          onClick={async () => {
            setPaying(true);
            setError("");
            try {
              await openCheckout("/api/tuition/checkout", { invoiceId: inv.id });
            } catch (e: any) {
              setError(e.message);
              setPaying(false);
            }
          }}
        >
          {paying ? "Abrindo pagamento…" : "Pagar com desconto"}
        </PhysicalButton>
        <button type="button" onClick={() => setInv(null)} style={{ background: "none", border: 0, fontFamily: "inherit", fontWeight: 600, fontSize: 13.5, color: "var(--muted)", cursor: "pointer", padding: 6 }}>
          Agora não
        </button>
      </div>
    </div>
  );
}

export { openCheckout };

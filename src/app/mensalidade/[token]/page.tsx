"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui";
import { TuitionCard, openCheckout, type TuitionStateView } from "@/components/Tuition";

// Página do responsável financeiro, aberta pelo link dos e-mails. Não pede
// login: o responsável não tem conta no app.
export default function GuardianTuitionPage() {
  const params = useParams();
  const token = params?.token as string;
  const [state, setState] = useState<(TuitionStateView & { studentName: string | null; guardianName: string | null }) | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/tuition/guardian/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setState(await r.json());
      })
      .catch(() => setNotFound(true));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink-on-dark)", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 20 }}>Unblocking Minds</div>
        {notFound && (
          <Card>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              Este link não está mais ativo. Use o link do e-mail mais recente ou fale com a Unblocking Minds.
            </div>
          </Card>
        )}
        {!state && !notFound && <Card>Carregando…</Card>}
        {state && (
          <TuitionCard
            state={state}
            title={state.studentName ? `Mensalidade de ${state.studentName}` : "Mensalidade"}
            intro={
              <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
                {state.guardianName ? `Olá, ${state.guardianName}. ` : ""}Esta é a página de pagamento da mensalidade
                {state.studentName ? ` de ${state.studentName}` : ""} na Unblocking Minds. O link é exclusivo seu.
              </div>
            }
            payingId={payingId}
            error={error}
            onPay={async (id) => {
              setPayingId(id);
              setError("");
              try {
                await openCheckout(`/api/tuition/guardian/${token}`, { invoiceId: id });
              } catch (e: any) {
                setError(e.message);
                setPayingId(null);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

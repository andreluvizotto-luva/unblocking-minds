"use client";

import React, { useEffect, useState } from "react";
import { Card, ProcessingAnimation } from "@/components/ui";

// Retorno do checkout da mensalidade (aluno ou responsável financeiro, este
// sem conta). A confirmação acontece no servidor, que consulta a InfinitePay.
export default function TuitionReturnPage() {
  const [state, setState] = useState<"checking" | "waiting" | "paid" | "error">("checking");
  const [month, setMonth] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const body = {
      order_nsu: q.get("order_nsu"),
      transaction_nsu: q.get("transaction_nsu"),
      slug: q.get("slug"),
      receipt_url: q.get("receipt_url"),
    };
    if (!body.order_nsu || !body.transaction_nsu || !body.slug) {
      setState("error");
      return;
    }
    let tries = 0;
    let stop = false;
    const attempt = async () => {
      tries++;
      try {
        const res = await fetch("/api/tuition/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.paid) {
          setMonth(data.monthLabel || null);
          setState("paid");
          return;
        }
      } catch {}
      if (stop) return;
      if (tries < 6) {
        setState("waiting");
        setTimeout(attempt, 4000);
      } else setState("error");
    };
    attempt();
    return () => {
      stop = true;
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Card style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        {(state === "checking" || state === "waiting") && (
          <ProcessingAnimation
            title={state === "checking" ? "Confirmando o pagamento…" : "Estamos confirmando com a InfinitePay…"}
            messages={["Isso leva só alguns segundos.", "Pix costuma ser instantâneo.", "Quase lá…"]}
          />
        )}
        {state === "paid" && (
          <>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, margin: "0 0 8px", color: "var(--ink)" }}>Pagamento confirmado!</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              Recebemos a mensalidade{month ? ` de ${month}` : ""}. O comprovante foi enviado por e-mail. Pode fechar esta página.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 19, margin: "0 0 8px", color: "var(--ink)" }}>Ainda não conseguimos confirmar</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              Se o pagamento foi concluído, a confirmação chega em instantes e você recebe um e-mail. Não é preciso pagar de novo.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

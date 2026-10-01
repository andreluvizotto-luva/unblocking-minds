"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PhysicalButton, ProcessingAnimation } from "@/components/ui";

// A InfinitePay manda o aluno para cá depois do pagamento, com order_nsu,
// transaction_nsu, slug e receipt_url na URL. A confirmação é feita no
// servidor (/api/billing/confirm), que consulta a própria InfinitePay.
export default function RetornoPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "paid" | "waiting" | "error">("checking");
  const [until, setUntil] = useState<string | null>(null);

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
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) return router.push("/login");
        const data = await res.json();
        if (data.paid) {
          setUntil(data.accessUntil || null);
          setState("paid");
          return;
        }
      } catch {}
      if (stop) return;
      if (tries < 6) {
        setState("waiting");
        setTimeout(attempt, 4000);
      } else {
        setState("error");
      }
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
            title={state === "checking" ? "Confirmando seu pagamento…" : "Estamos confirmando com a InfinitePay…"}
            messages={["Isso leva só alguns segundos.", "Pix costuma ser instantâneo.", "Quase lá…"]}
          />
        )}
        {state === "paid" && (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🎉</div>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, margin: "0 0 8px", color: "var(--ink)" }}>Pagamento confirmado!</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>
              {until ? `Seu acesso está garantido até ${new Date(until).toLocaleDateString("pt-BR")}.` : "Seu acesso foi liberado."}
            </p>
            <PhysicalButton onClick={() => router.push("/")} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
              Praticar agora
            </PhysicalButton>
          </>
        )}
        {state === "error" && (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>⏳</div>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 19, margin: "0 0 8px", color: "var(--ink)" }}>Ainda não conseguimos confirmar</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>
              Se você concluiu o pagamento, a confirmação chega em instantes e o acesso é liberado sozinho. Você também recebe um e-mail.
            </p>
            <PhysicalButton onClick={() => router.push("/assinatura")} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
              Ver minha assinatura
            </PhysicalButton>
          </>
        )}
      </Card>
    </div>
  );
}

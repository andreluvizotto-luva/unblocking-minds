"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, PhysicalButton } from "@/components/ui";

type Reason = "disabled" | "expired" | "demo_ended" | "subscription_ended";

const COPY: Record<Reason, { icon: string; title: string; body: string; pay?: boolean }> = {
  disabled: {
    icon: "🔒",
    title: "Acesso indisponível",
    body: "Sua conta foi desabilitada. Fale com a administração do +Unblocking para mais informações.",
  },
  expired: {
    icon: "🔒",
    title: "Acesso indisponível",
    body: "O prazo de acesso da sua conta expirou. Fale com a administração do +Unblocking para renovar.",
  },
  demo_ended: {
    icon: "⏳",
    title: "Seu teste grátis acabou",
    body: "Gostou de praticar? Assine o plano mensal e continue de onde parou. Seu histórico e suas conquistas continuam salvos.",
    pay: true,
  },
  subscription_ended: {
    icon: "⏳",
    title: "Sua assinatura venceu",
    body: "Renove por mais 30 dias, com Pix ou cartão, e volte a praticar na hora. Seu histórico continua salvo.",
    pay: true,
  },
};

export default function BloqueadoPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [reason, setReason] = useState<Reason>("disabled");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("blockReason") : null;
    if (stored && stored in COPY) setReason(stored as Reason);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const copy = COPY[reason];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink-on-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <Card style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>{copy.icon}</div>
        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 19, margin: "0 0 10px" }}>
          {copy.title}
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, marginBottom: 18 }}>{copy.body}</p>
        {copy.pay && (
          <PhysicalButton
            onClick={() => router.push("/assinatura")}
            background="var(--teal)"
            color="var(--ink)"
            shadowColor="var(--mustard)"
            style={{ marginBottom: 12 }}
          >
            {reason === "demo_ended" ? "Assinar" : "Renovar"}
          </PhysicalButton>
        )}
        <Button onClick={signOut} variant={copy.pay ? "subtle" : "primary"} style={{ width: "100%" }}>
          Sair
        </Button>
      </Card>
    </div>
  );
}

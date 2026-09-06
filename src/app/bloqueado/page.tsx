"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button } from "@/components/ui";

type Reason = "disabled" | "expired" | "pending";

const COPY: Record<Reason, { icon: string; title: string; body: string }> = {
  pending: {
    icon: "⏳",
    title: "Cadastro recebido!",
    body:
      "Sua conta ainda está aguardando liberação de um administrador do +Unblocking. Assim que ela for aprovada, você já pode voltar aqui e começar a praticar.",
  },
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
};

export default function BloqueadoPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [reason, setReason] = useState<Reason>("disabled");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("blockReason") : null;
    if (stored === "expired" || stored === "pending") setReason(stored);
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
        <Button onClick={signOut} style={{ width: "100%" }}>Sair</Button>
      </Card>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = { category: string; isAdmin: boolean; daysLeft: number };

// Aviso discreto na home: teste grátis em andamento, ou assinatura perto de
// vencer (3 dias ou menos). Alunos Unblocking e admins não veem nada.
export function BillingBanner() {
  const router = useRouter();
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => {});
  }, []);

  if (!s || s.isAdmin || s.category === "unblocking") return null;
  if (s.category === "app" && s.daysLeft > 3) return null;

  const dias = `${s.daysLeft} ${s.daysLeft === 1 ? "dia" : "dias"}`;
  const text =
    s.category === "demo"
      ? s.daysLeft <= 1
        ? "Seu teste grátis termina hoje"
        : `Teste grátis: faltam ${dias}`
      : s.daysLeft <= 1
        ? "Sua assinatura vence hoje"
        : `Sua assinatura vence em ${dias}`;

  return (
    <button
      onClick={() => router.push("/assinatura")}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        marginBottom: 16,
        padding: "11px 14px",
        borderRadius: 14,
        border: "1px solid rgba(246,160,23,.45)",
        background: "rgba(246,160,23,.14)",
        color: "var(--ink-on-dark)",
        fontFamily: "inherit",
        fontSize: 13.5,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span>{text}</span>
      <span style={{ fontWeight: 700, color: "var(--teal)", whiteSpace: "nowrap" }}>
        {s.category === "demo" ? "Assinar →" : "Renovar →"}
      </span>
    </button>
  );
}

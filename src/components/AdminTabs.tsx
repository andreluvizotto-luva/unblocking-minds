"use client";

import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/financeiro", label: "Financeiro" },
];

export function AdminTabs({ active }: { active: "/admin" | "/admin/financeiro" }) {
  return (
    <nav aria-label="Seções do admin" style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {TABS.map((t) => {
        const on = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            style={{
              padding: "7px 16px",
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: "none",
              border: on ? "1px solid var(--mustard)" : "1px solid rgba(255,255,255,.25)",
              background: on ? "var(--mustard)" : "transparent",
              color: on ? "var(--ink)" : "var(--ink-on-dark)",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

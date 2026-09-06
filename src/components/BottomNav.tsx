"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11.5L12 4l8 7.5"
        stroke={active ? "var(--ink)" : "var(--muted)"}
        strokeWidth={active ? 2.2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v8.2c0 .44.36.8.8.8H10v-5.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V19h3.2c.44 0 .8-.36.8-.8V10"
        stroke={active ? "var(--ink)" : "var(--muted)"}
        strokeWidth={active ? 2.2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "var(--ink)" : "none"}
        fillOpacity={active ? 0.06 : 0}
      />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="8.2"
        r="3.4"
        stroke={active ? "var(--ink)" : "var(--muted)"}
        strokeWidth={active ? 2.2 : 1.6}
        fill={active ? "var(--ink)" : "none"}
        fillOpacity={active ? 0.06 : 0}
      />
      <path
        d="M4.8 19.2c1.2-3.4 4-5 7.2-5s6 1.6 7.2 5"
        stroke={active ? "var(--ink)" : "var(--muted)"}
        strokeWidth={active ? 2.2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 4H6.8A1.8 1.8 0 0 0 5 5.8v12.4A1.8 1.8 0 0 0 6.8 20H9"
        stroke="var(--muted)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M14 8l4.5 4-4.5 4" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.4 12H9.5" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { key: "practice", label: "Praticar", path: "/", Icon: HomeIcon },
  { key: "profile", label: "Perfil", path: "/perfil", Icon: UserIcon },
];

export function BottomNav({ onSignOut }: { onSignOut?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: "var(--card)",
        borderTop: "1px solid var(--line)",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -4px 16px rgba(16, 20, 58, 0.10)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "stretch" }}>
        {NAV_ITEMS.map(({ key, label, path, Icon }) => {
          const active = pathname === path;
          return (
            <button
              key={key}
              onClick={() => router.push(path)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "9px 0 7px",
                background: "none",
                border: "none",
                cursor: "pointer",
                transition: "transform 0.15s ease",
                transform: active ? "translateY(-1px) scale(1.05)" : "none",
              }}
            >
              <Icon active={active} />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--ink)" : "var(--muted)",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
        {onSignOut && (
          <button
            onClick={onSignOut}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "9px 0 7px",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <LogoutIcon />
            <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--muted)" }}>Sair</span>
          </button>
        )}
      </div>
    </nav>
  );
}

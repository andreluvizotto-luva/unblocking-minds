"use client";

import React from "react";
import { ProgressBar } from "@/components/ui";

export type AchievementItem = {
  code: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number } | null;
};

// Selo redondo de conquista — cheio de cor quando desbloqueado, apagado e
// em tom de cinza quando ainda travado (com um cadeado no canto).
export function AchievementBadge({ a, size = 58 }: { a: AchievementItem; size?: number }) {
  return (
    <div
      title={a.unlocked ? `${a.title} — ${a.description}` : `Bloqueada: ${a.description}`}
      style={{ width: size + 20, textAlign: "center", flexShrink: 0 }}
    >
      <div
        className={a.unlocked ? "pop-in" : undefined}
        style={{
          width: size,
          height: size,
          margin: "0 auto 6px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.44,
          position: "relative",
          background: a.unlocked ? "linear-gradient(155deg, #ffe3a8, var(--teal))" : "rgba(255,255,255,0.08)",
          border: a.unlocked ? "1px solid rgba(246,160,23,0.5)" : "1px solid var(--line-on-dark)",
          boxShadow: a.unlocked ? "0 3px 10px rgba(246,160,23,0.35)" : "none",
          filter: a.unlocked ? "none" : "grayscale(1)",
          opacity: a.unlocked ? 1 : 0.4,
        }}
      >
        {a.icon}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.25, color: a.unlocked ? "inherit" : "var(--muted-on-dark)" }}>
        {a.title}
      </div>
    </div>
  );
}

// Tira de conquistas + progresso para a próxima — usada tanto no topo da
// tela inicial (versão compacta) quanto na tela de Perfil (completa).
export function AchievementStrip({
  achievements,
  nextAchievement,
  onDark = true,
}: {
  achievements: AchievementItem[];
  nextAchievement: AchievementItem | null;
  onDark?: boolean;
}) {
  if (achievements.length === 0) return null;
  const mutedColor = onDark ? "var(--muted-on-dark)" : "var(--muted)";

  return (
    <div>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4, marginBottom: nextAchievement ? 12 : 0 }}>
        {achievements.map((a) => (
          <AchievementBadge key={a.code} a={a} />
        ))}
      </div>

      {nextAchievement && !nextAchievement.unlocked && (
        <div>
          {nextAchievement.progress ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4, color: mutedColor }}>
                <span>
                  Próxima: <strong style={{ color: "inherit" }}>{nextAchievement.title}</strong>
                </span>
                <span>
                  {nextAchievement.progress.current}/{nextAchievement.progress.target}
                </span>
              </div>
              <ProgressBar value={nextAchievement.progress.current} max={nextAchievement.progress.target} />
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: mutedColor }}>
              Próxima conquista: <strong style={{ color: "inherit" }}>{nextAchievement.title}</strong> — {nextAchievement.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

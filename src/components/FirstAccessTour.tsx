"use client";

import React, { useEffect, useRef, useState } from "react";
import { PhysicalButton } from "@/components/ui";

// Tour do primeiro acesso: apresenta o jeito Unblocking de estudar e leva o
// aluno até a primeira aula. A decisão de mostrar (aluno sem aulas feitas, e
// que ainda não concluiu ou pulou o tour) fica na home.

const SKILLS = ["Leitura", "Gramática", "Escuta", "Fala", "Escrita"];

export const tourKey = (userId: string) => `unblocking:tour:${userId}`;

type Step = { eyebrow: string; title: string; body: React.ReactNode; extra?: React.ReactNode };

export function FirstAccessTour({
  name,
  needsLevel,
  onClose,
}: {
  name: string | null;
  needsLevel: boolean;
  // Chamado ao concluir ou pular; "finished" é true só no último passo.
  onClose: (finished: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const first = name ? name.trim().split(/\s+/)[0] : null;

  const steps: Step[] = [
    {
      eyebrow: "Boas-vindas",
      title: first ? `Que bom ter você aqui, ${first}` : "Que bom ter você aqui",
      body: (
        <>
          No +Unblocking, o inglês destrava aos poucos, um dia de cada vez. Sem pressa e sem pressão: só você, o seu ritmo e uma aula pensada para o seu nível.
        </>
      ),
    },
    {
      eyebrow: "Como funciona",
      title: "Uma aula por dia, cinco habilidades",
      body: <>É assim que o idioma sai do papel e vira voz. Cada aula passa por estas etapas e leva poucos minutos. Se precisar parar, você retoma de onde parou.</>,
      extra: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {SKILLS.map((s) => (
            <span key={s} style={{ background: "#fdf0d6", border: "1px solid #f1c775", color: "#7a4d05", borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600 }}>
              {s}
            </span>
          ))}
        </div>
      ),
    },
    {
      eyebrow: "Respire, fale, desbloqueie",
      title: "Sua voz também precisa de apoio",
      body: <>Antes da fala, a gente respira junto: respirar bem ajuda a desbloquear a fala espontânea. E errar faz parte de destravar. No fim da aula, o seu relatório mostra o que já está firme e o que vale praticar mais.</>,
      extra: (
        <div style={{ marginTop: 14, borderRadius: 14, background: "var(--sage)", color: "#f7f5ef", padding: "12px 14px", fontSize: 13.5, lineHeight: 1.5 }}>
          Inspira. Segura. Solta. Agora, fala.
        </div>
      ),
    },
    {
      eyebrow: "Você escolhe",
      title: "O assunto e o formato da aula",
      body: <>Pode ser música, viagem, trabalho, uma notícia do momento ou uma situação sua. Depois, o formato: <b>Full lesson</b> para o dia em que você tem mais tempo, ou só uma ou duas habilidades quando o tempo está curto.</>,
    },
    {
      eyebrow: "Let's go",
      title: "Vamos destravar a sua primeira aula?",
      body: needsLevel ? (
        <>Primeiro, conte para a gente o seu nível de inglês. Com ele, cada aula já nasce na medida certa para você. Depois é só escolher o assunto e o formato.</>
      ) : (
        <>Escolha o assunto e o formato e toque em <b>“Começar aula de hoje”</b>. Ela é preparada na hora, para o seu nível, e leva cerca de um minuto para ficar pronta.</>
      ),
    },
  ];

  const last = i === steps.length - 1;
  const s = steps[i];

  useEffect(() => {
    box.current?.querySelector("button")?.focus();
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      ref={box}
      style={{ position: "fixed", inset: 0, background: "rgba(16,20,58,.72)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div
        key={i}
        className="fade-in-up"
        style={{ background: "#fff", color: "var(--ink)", borderRadius: 22, padding: "22px 22px 16px", maxWidth: 400, width: "100%", boxShadow: "0 18px 40px rgba(0,0,0,.28)", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mustard-dark)" }}>{s.eyebrow}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }} aria-label={`Passo ${i + 1} de ${steps.length}`}>
            {i + 1}/{steps.length}
          </span>
        </div>
        <h2 id="tour-title" style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: 21, lineHeight: 1.25, fontWeight: 600, letterSpacing: "-0.015em", textWrap: "balance" as any }}>
          {s.title}
        </h2>
        <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14.5, lineHeight: 1.6, color: "#3b3a4a" }}>
          {s.body}
          {s.extra}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "6px 0 2px" }} aria-hidden="true">
          {steps.map((_, n) => (
            <span key={n} style={{ width: n === i ? 18 : 6, height: 6, borderRadius: 999, background: n === i ? "var(--teal)" : "#e2ddd0", transition: "width .2s" }} />
          ))}
        </div>

        <PhysicalButton
          onClick={() => (last ? onClose(true) : setI(i + 1))}
          background="var(--teal)"
          color="var(--ink)"
          shadowColor="var(--mustard)"
          style={{ minHeight: 52, fontSize: 16 }}
        >
          {last ? (needsLevel ? "Informar meu nível" : "Escolher minha aula") : i === 0 ? "Começar o tour" : "Próximo"}
        </PhysicalButton>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 30 }}>
          {i > 0 ? (
            <button type="button" onClick={() => setI(i - 1)} style={linkBtn}>
              Voltar
            </button>
          ) : (
            <span />
          )}
          {!last && (
            <button type="button" onClick={() => onClose(false)} style={linkBtn}>
              Pular tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = { background: "none", border: 0, padding: 6, fontFamily: "inherit", fontWeight: 600, fontSize: 13.5, color: "var(--muted)", cursor: "pointer" };

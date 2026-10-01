"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Lockup } from "@/components/ui";
import { BottomNav } from "@/components/BottomNav";
import { checkAccessOrRedirect } from "@/lib/access-check";
import { QuizGame, GuessGame } from "@/components/Games";
import { WordsGame } from "@/components/WordsGame";
import { QUIZ_MAX_SCORE, GUESS_MAX_SCORE, TRIVIA_MAX_SCORE, WORDS_MAX_SCORE } from "@/lib/games";

type View = "menu" | "quiz" | "guess" | "trivia" | "words";
const VIEWS = ["quiz", "guess", "trivia", "words"];

const GAMES = [
  {
    id: "quiz" as const,
    title: "Quiz",
    description: "Perguntas rápidas de vocabulário, expressões e cultura. Cada acerto vale pontos.",
    max: QUIZ_MAX_SCORE,
    color: "var(--teal)",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
  },
  {
    id: "guess" as const,
    title: "Who is it?",
    description: "Descubra a personalidade pelas dicas em inglês. Quanto menos dicas pedir, mais pontos.",
    max: GUESS_MAX_SCORE,
    color: "var(--coral)",
    icon: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  },
  {
    id: "trivia" as const,
    title: "Trivia",
    description: "Cultura geral em inglês: geografia, ciência, história, cinema e mais.",
    max: TRIVIA_MAX_SCORE,
    color: "var(--sage)",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  },
  {
    id: "words" as const,
    title: "Word Builder",
    description: "Forme palavras com 7 letras sorteadas, contra o relógio. Palavras maiores valem mais.",
    max: WORDS_MAX_SCORE,
    color: "var(--mustard)",
    icon: (
      <>
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </>
    ),
  },
];

const GAME_LABEL: Record<string, string> = { quiz: "Quiz", guess: "Who is it?", trivia: "Trivia", words: "Word Builder" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function GamesPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [scores, setScores] = useState<{ available: boolean; best: Record<string, number>; history: any[] } | null>(null);

  async function loadScores() {
    try {
      const res = await fetch("/api/games/score");
      if (res.ok) setScores(await res.json());
    } catch {
      // recorde é um bônus visual — se falhar, os games seguem jogáveis
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const ok = await checkAccessOrRedirect(supabase, data.user.id, router);
      if (!ok) return;
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
      setIsAdmin(!!profile?.is_admin);
      setCheckingAuth(false);

      // O cartão de Games da tela inicial leva direto a um jogo
      // (/games?game=quiz). Lido via window em vez de useSearchParams, que
      // exigiria envolver a página inteira num Suspense.
      const g = new URLSearchParams(window.location.search).get("game");
      if (g && VIEWS.includes(g)) setView(g as View);

      loadScores();
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function exitGame() {
    setView("menu");
    window.history.replaceState(null, "", "/games");
    loadScores();
  }

  if (checkingAuth) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: "#283758", padding: "44px 20px 22px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Lockup size={18} />
            <button
              onClick={() => (view === "menu" ? router.push("/") : exitGame())}
              style={{ border: "none", background: "transparent", color: "var(--muted-on-dark)", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}
            >
              {view === "menu" ? "← Voltar ao início" : "← Voltar aos games"}
            </button>
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: 26, fontWeight: 600, color: "var(--ink-on-dark)", letterSpacing: "-0.02em" }}>
              {view === "menu" ? "Games" : GAME_LABEL[view]}
            </h1>
            {view === "menu" && (
              <p style={{ margin: "4px 0 0", fontFamily: "'Caveat', cursive", fontSize: 20, color: "var(--mustard-bright)" }}>Let&apos;s play! Pratique inglês jogando.</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: "#f7f5ef", minHeight: "calc(100vh - 160px)", padding: "22px 20px 100px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", color: "var(--ink)" }}>
          {view === "quiz" && <QuizGame onExit={exitGame} />}
          {view === "guess" && <GuessGame onExit={exitGame} />}
          {view === "trivia" && <QuizGame variant="trivia" onExit={exitGame} />}
          {view === "words" && <WordsGame onExit={exitGame} />}

          {view === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setView(g.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    textAlign: "left",
                    width: "100%",
                    padding: 18,
                    borderRadius: 18,
                    border: "1px solid rgba(16,20,58,.1)",
                    background: "#fffdf7",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ width: 48, height: 48, borderRadius: 999, background: g.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {g.icon}
                    </svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{g.title}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.4, color: "var(--muted)" }}>{g.description}</span>
                    {scores?.available && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mustard-dark)", marginTop: 2 }}>
                        Recorde: {scores.best[g.id] ?? 0} de {g.max} pts
                      </span>
                    )}
                  </span>
                </button>
              ))}

              {scores?.available && scores.history.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Suas últimas partidas</span>
                  {scores.history.map((h, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#fffdf7", border: "1px solid rgba(16,20,58,.07)", fontSize: 13.5 }}
                    >
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <strong style={{ fontWeight: 600 }}>{GAME_LABEL[h.game] || h.game}</strong>
                        {h.game === "guess" && h.detail?.name ? <span style={{ color: "var(--muted)" }}> · {h.detail.name}</span> : null}
                        {h.game === "words" && h.detail?.possible ? (
                          <span style={{ color: "var(--muted)" }}>
                            {" "}
                            · {h.detail.found} palavras
                          </span>
                        ) : null}
                        {(h.game === "quiz" || h.game === "trivia") && h.detail?.total ? (
                          <span style={{ color: "var(--muted)" }}>
                            {" "}
                            · {h.detail.correct}/{h.detail.total} certas
                          </span>
                        ) : null}
                      </span>
                      <span style={{ flexShrink: 0, color: "var(--muted)" }}>
                        <strong style={{ color: "var(--ink)", fontWeight: 600 }}>{h.score}</strong> pts · {formatDate(h.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNav onSignOut={signOut} isAdmin={isAdmin} />
    </div>
  );
}

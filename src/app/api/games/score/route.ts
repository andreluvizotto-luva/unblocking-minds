import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";
import { GAME_MAX_SCORE } from "@/lib/games";

// Recorde e histórico dos Games. game_scores não tem policy de RLS para o
// aluno (ver criar-tabela-game-scores.sql), então tudo passa por aqui, com
// a chave service_role e sempre filtrado pelo id do usuário autenticado.
//
// Se a tabela ainda não existir (SQL não rodado), as duas rotas respondem
// "available: false" em vez de erro — os games continuam jogáveis, só sem
// salvar pontuação.

export async function GET() {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { data, error } = await supabaseAdmin()
    .from("game_scores")
    .select("game, score, max_score, detail, created_at")
    .eq("user_id", check.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[games/score] leitura falhou (tabela criada?):", error.message);
    return NextResponse.json({ available: false, best: {}, history: [] });
  }

  const best: Record<string, number> = {};
  for (const row of data || []) {
    best[row.game] = Math.max(best[row.game] ?? 0, row.score);
  }

  return NextResponse.json({ available: true, best, history: (data || []).slice(0, 10) });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  const game = body?.game;
  const maxScore = GAME_MAX_SCORE[game];
  if (!maxScore) {
    return NextResponse.json({ error: "Game desconhecido." }, { status: 400 });
  }

  // A pontuação vem do navegador, então é limitada ao máximo possível da
  // partida: dá para mentir dentro do intervalo, mas não inflar o recorde
  // além do que o próprio jogo permite.
  const score = Math.max(0, Math.min(maxScore, Math.round(Number(body?.score) || 0)));

  // Só campos conhecidos vão para "detail" — nunca o objeto inteiro que o
  // cliente mandou.
  const d = body?.detail || {};
  const detail =
    game === "guess"
      ? { name: typeof d.name === "string" ? d.name.slice(0, 100) : null, cluesShown: Number(d.cluesShown) || 0, solved: !!d.solved }
      : game === "words"
        ? { letters: typeof d.letters === "string" ? d.letters.slice(0, 7) : null, found: Number(d.found) || 0, possible: Number(d.possible) || 0 }
        : game === "trivia"
          ? {
              correct: Number(d.correct) || 0,
              total: Number(d.total) || 0,
              // Perguntas jogadas, para a próxima rodada não repetir.
              seen: (Array.isArray(d.seen) ? d.seen : []).filter((x: any) => typeof x === "string").slice(0, 12).map((x: string) => x.slice(0, 90)),
            }
          : { correct: Number(d.correct) || 0, total: Number(d.total) || 0 };

  const { error } = await supabaseAdmin()
    .from("game_scores")
    .insert({ user_id: check.userId, game, score, max_score: maxScore, detail });

  if (error) {
    console.error("[games/score] gravação falhou (tabela criada?):", error.message);
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({ available: true, saved: true });
}

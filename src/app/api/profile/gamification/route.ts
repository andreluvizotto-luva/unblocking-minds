import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Devolve a sequência de dias do aluno e o catálogo completo de
// conquistas, marcando quais já foram desbloqueadas, além de quanto falta
// para a próxima conquista alcançável (quando dá pra calcular um número).
// Usado na tela de Perfil e no topo da tela inicial.
const PROGRESS_TARGET: Record<string, number> = {
  first_session: 1,
  streak_3: 3,
  streak_7: 7,
  streak_30: 30,
  sessions_10: 10,
  sessions_50: 50,
};

const PROGRESS_SOURCE: Record<string, "streak" | "sessions"> = {
  first_session: "sessions",
  streak_3: "streak",
  streak_7: "streak",
  streak_30: "streak",
  sessions_10: "sessions",
  sessions_50: "sessions",
};

export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [{ data: profile }, { data: achievements }, { data: unlocked }, { count: sessionCount }] = await Promise.all([
    supabase.from("profiles").select("current_streak, longest_streak, last_practice_date").eq("id", user.id).single(),
    supabase.from("achievements").select("code, title, description, icon, sort_order").order("sort_order"),
    // user_achievements não tem RLS de aluno (ver schema.sql) — chave admin,
    // sempre filtrada pelo id do usuário já autenticado acima.
    supabaseAdmin().from("user_achievements").select("achievement_code, unlocked_at").eq("user_id", user.id),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
  ]);

  const unlockedMap = new Map((unlocked || []).map((u: any) => [u.achievement_code, u.unlocked_at]));
  const currentStreak = profile?.current_streak ?? 0;

  const achievementList = (achievements || []).map((a: any) => {
    const source = PROGRESS_SOURCE[a.code];
    const target = PROGRESS_TARGET[a.code];
    const current = source === "streak" ? currentStreak : source === "sessions" ? sessionCount ?? 0 : null;
    return {
      code: a.code,
      title: a.title,
      description: a.description,
      icon: a.icon,
      unlocked: unlockedMap.has(a.code),
      unlockedAt: unlockedMap.get(a.code) ?? null,
      progress: current !== null && target ? { current: Math.min(current, target), target } : null,
    };
  });

  // Próxima conquista a mirar: a primeira ainda travada, na ordem do
  // catálogo, priorizando uma que tenha um número claro de progresso.
  const locked = achievementList.filter((a) => !a.unlocked);
  const nextAchievement = locked.find((a) => a.progress) || locked[0] || null;

  return NextResponse.json({
    currentStreak,
    longestStreak: profile?.longest_streak ?? 0,
    lastPracticeDate: profile?.last_practice_date ?? null,
    sessionCount: sessionCount ?? 0,
    achievements: achievementList,
    nextAchievement,
  });
}

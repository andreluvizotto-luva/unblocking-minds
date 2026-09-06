import type { SupabaseClient } from "@supabase/supabase-js";

// Sequência de dias (streak) e conquistas do aluno. Tudo aqui é chamado a
// partir de /api/report/generate, no momento em que uma aula é marcada
// como concluída — é o único ponto do fluxo que garante que a aula foi
// mesmo finalizada.

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type UnlockedAchievement = {
  code: string;
  title: string;
  description: string;
  icon: string;
};

function todayISODate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86400000);
}

// Atualiza a sequência de dias do aluno. Se ele já praticou hoje, não
// mexe em nada (evita contar duas sessões no mesmo dia). Se a última
// prática foi ontem, soma um dia. Se foi há mais de um dia, reinicia a
// sequência em 1.
export async function updateStreakOnCompletion(
  supabase: SupabaseClient,
  userId: string
): Promise<{ currentStreak: number; longestStreak: number; isFirstToday: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_streak, longest_streak, last_practice_date")
    .eq("id", userId)
    .single();

  const today = todayISODate();
  const lastDate: string | null = profile?.last_practice_date || null;
  let currentStreak = profile?.current_streak ?? 0;
  let longestStreak = profile?.longest_streak ?? 0;

  if (lastDate === today) {
    return { currentStreak, longestStreak, isFirstToday: false };
  }

  if (lastDate && daysBetween(lastDate, today) === 1) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  await supabase
    .from("profiles")
    .update({ current_streak: currentStreak, longest_streak: longestStreak, last_practice_date: today })
    .eq("id", userId);

  return { currentStreak, longestStreak, isFirstToday: true };
}

// Verifica os gatilhos de conquista e desbloqueia as que ainda não foram
// conquistadas. Retorna só as que foram desbloqueadas agora (para o front
// mostrar a celebração), não a lista completa.
export async function checkAndUnlockAchievements(
  supabase: SupabaseClient,
  userId: string,
  params: {
    currentStreak: number;
    level: string;
    overall: number | null;
    bySkill: Record<string, { score: string } | undefined>;
  }
): Promise<UnlockedAchievement[]> {
  const { data: existing } = await supabase
    .from("user_achievements")
    .select("achievement_code")
    .eq("user_id", userId);
  const unlockedCodes = new Set((existing || []).map((r: any) => r.achievement_code as string));

  const { count: sessionCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");

  const toUnlock: string[] = [];
  const maybeUnlock = (code: string, condition: boolean) => {
    if (!unlockedCodes.has(code) && condition) toUnlock.push(code);
  };

  maybeUnlock("first_session", (sessionCount ?? 0) >= 1);
  maybeUnlock("streak_3", params.currentStreak >= 3);
  maybeUnlock("streak_7", params.currentStreak >= 7);
  maybeUnlock("streak_30", params.currentStreak >= 30);
  maybeUnlock("sessions_10", (sessionCount ?? 0) >= 10);
  maybeUnlock("sessions_50", (sessionCount ?? 0) >= 50);
  maybeUnlock("score_9", typeof params.overall === "number" && params.overall >= 9);

  const skillKeys = ["reading", "grammar", "listening", "speaking", "writing"];
  const allStrong = skillKeys.every((k) => params.bySkill?.[k]?.score === "forte");
  maybeUnlock("all_strong", allStrong);

  if (!unlockedCodes.has("level_up")) {
    const { data: priorSessions } = await supabase
      .from("sessions")
      .select("level")
      .eq("user_id", userId)
      .eq("status", "completed");
    const currentOrder = CEFR_ORDER.indexOf(params.level);
    const hadLowerLevelBefore = (priorSessions || []).some(
      (r: any) => CEFR_ORDER.indexOf(r.level) < currentOrder
    );
    maybeUnlock("level_up", hadLowerLevelBefore);
  }

  if (toUnlock.length === 0) return [];

  const { data: defs } = await supabase
    .from("achievements")
    .select("code, title, description, icon")
    .in("code", toUnlock);

  await supabase
    .from("user_achievements")
    .upsert(
      toUnlock.map((code) => ({ user_id: userId, achievement_code: code })),
      { onConflict: "user_id,achievement_code", ignoreDuplicates: true }
    );

  return (defs || []) as UnlockedAchievement[];
}

import type { SupabaseClient } from "@supabase/supabase-js";

// Dificuldade adaptativa por habilidade — chamado a partir de
// /api/report/generate assim que uma aula é concluída. A cada 10
// avaliações "forte" seguidas numa habilidade, aquela habilidade fica
// 10% mais desafiadora dali em diante nas próximas aulas (cumulativo).
// Se a aula não for avaliada como "forte" naquela habilidade, a
// sequência reinicia — mas a dificuldade já conquistada não regride.
export const SKILLS = ["reading", "grammar", "listening", "speaking", "writing"] as const;
export type SkillKey = (typeof SKILLS)[number];

export type SkillDifficultyMap = Record<string, number>;

export async function updateSkillDifficulty(
  supabase: SupabaseClient,
  userId: string,
  bySkill: Record<string, { score?: string } | undefined>
): Promise<SkillDifficultyMap> {
  const { data: existing } = await supabase
    .from("skill_progress")
    .select("skill, consecutive_strong, difficulty_percent")
    .eq("user_id", userId);
  const rowBySkill = new Map((existing || []).map((r: any) => [r.skill, r]));

  const upserts: any[] = [];
  const result: SkillDifficultyMap = {};

  for (const skill of SKILLS) {
    const row = rowBySkill.get(skill) || { consecutive_strong: 0, difficulty_percent: 0 };
    const isStrong = bySkill?.[skill]?.score === "forte";
    const consecutive = isStrong ? row.consecutive_strong + 1 : 0;
    let difficulty = row.difficulty_percent;
    if (isStrong && consecutive % 10 === 0) {
      difficulty += 10;
    }
    result[skill] = difficulty;
    upserts.push({
      user_id: userId,
      skill,
      consecutive_strong: consecutive,
      difficulty_percent: difficulty,
      updated_at: new Date().toISOString(),
    });
  }

  await supabase.from("skill_progress").upsert(upserts, { onConflict: "user_id,skill" });
  return result;
}

// Usado em /api/session/generate para calibrar o prompt da próxima aula.
export async function getSkillDifficulty(supabase: SupabaseClient, userId: string): Promise<SkillDifficultyMap> {
  const { data } = await supabase.from("skill_progress").select("skill, difficulty_percent").eq("user_id", userId);
  const map: SkillDifficultyMap = {};
  for (const s of SKILLS) map[s] = 0;
  for (const r of data || []) map[(r as any).skill] = (r as any).difficulty_percent;
  return map;
}

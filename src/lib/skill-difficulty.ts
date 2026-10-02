import type { SupabaseClient } from "@supabase/supabase-js";

// Dificuldade adaptativa por habilidade — chamado a partir de
// /api/report/generate assim que uma aula (completa ou formato parcial) é
// concluída. Quando 7 das últimas 10 avaliações de uma habilidade forem
// "forte", ela fica 10% mais desafiadora dali em diante (cumulativo) e o
// histórico daquela habilidade recomeça, para o próximo aumento exigir outra
// leva de bom desempenho. A dificuldade conquistada nunca regride.
export const SKILLS = ["reading", "grammar", "listening", "speaking", "writing"] as const;
export type SkillKey = (typeof SKILLS)[number];

export type SkillDifficultyMap = Record<string, number>;

const WINDOW = 10;
const NEEDED = 7;
const STEP = 10;

export type SkillDifficultyUpdate = {
  difficulty: SkillDifficultyMap;
  increased: SkillKey[];
  totalIncreasesBefore: number;
  totalIncreasesAfter: number;
};

export async function updateSkillDifficulty(
  supabase: SupabaseClient,
  userId: string,
  bySkill: Record<string, { score?: string } | undefined>
): Promise<SkillDifficultyUpdate> {
  const { data: existing } = await supabase
    .from("skill_progress")
    .select("skill, consecutive_strong, difficulty_percent, recent_results")
    .eq("user_id", userId);
  const rowBySkill = new Map((existing || []).map((r: any) => [r.skill, r]));

  const upserts: any[] = [];
  const difficulty: SkillDifficultyMap = {};
  const increased: SkillKey[] = [];
  let before = 0;
  let after = 0;

  for (const skill of SKILLS) {
    const row = rowBySkill.get(skill) || { consecutive_strong: 0, difficulty_percent: 0, recent_results: "" };
    before += Math.floor(row.difficulty_percent / STEP);

    // Aula em formato parcial não inclui essa habilidade — isso não é o
    // mesmo que ter ido mal nela, então o histórico fica como está.
    if (!(skill in (bySkill || {}))) {
      difficulty[skill] = row.difficulty_percent;
      after += Math.floor(row.difficulty_percent / STEP);
      continue;
    }

    const isStrong = bySkill?.[skill]?.score === "forte";
    let recent = ((row.recent_results || "") + (isStrong ? "F" : "x")).slice(-WINDOW);
    let pct = row.difficulty_percent;
    if ((recent.match(/F/g) || []).length >= NEEDED) {
      pct += STEP;
      recent = "";
      increased.push(skill);
    }

    difficulty[skill] = pct;
    after += Math.floor(pct / STEP);
    upserts.push({
      user_id: userId,
      skill,
      consecutive_strong: isStrong ? row.consecutive_strong + 1 : 0,
      difficulty_percent: pct,
      recent_results: recent,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length) await supabase.from("skill_progress").upsert(upserts, { onConflict: "user_id,skill" });
  return { difficulty, increased, totalIncreasesBefore: before, totalIncreasesAfter: after };
}

// Usado em /api/session/generate para calibrar o prompt da próxima aula.
export async function getSkillDifficulty(supabase: SupabaseClient, userId: string): Promise<SkillDifficultyMap> {
  const { data } = await supabase.from("skill_progress").select("skill, difficulty_percent").eq("user_id", userId);
  const map: SkillDifficultyMap = {};
  for (const s of SKILLS) map[s] = 0;
  for (const r of data || []) map[(r as any).skill] = (r as any).difficulty_percent;
  return map;
}

// Ao subir de nível CEFR pela sugestão, o desafio extra acumulado no nível
// anterior zera: o próprio nível novo já é o passo seguinte.
export async function resetSkillDifficulty(supabase: SupabaseClient, userId: string) {
  await supabase
    .from("skill_progress")
    .update({ difficulty_percent: 0, recent_results: "", updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

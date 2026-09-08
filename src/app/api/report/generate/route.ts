import { NextResponse } from "next/server";
import { askClaude, UNBLOCKING_VOICE_SYSTEM_PROMPT } from "@/lib/claude";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateStreakOnCompletion, checkAndUnlockAchievements } from "@/lib/gamification";
import { updateSkillDifficulty } from "@/lib/skill-difficulty";

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Esta leitura usa a sessão do próprio aluno de propósito: a RLS garante
  // que ele só enxerga as próprias aulas, então se a linha veio, a aula é
  // dele. Daqui pra frente as ESCRITAS usam a chave service_role, porque o
  // aluno não pode mais escrever nessas tabelas direto do navegador.
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  }

  const admin = supabaseAdmin();

  const { data: difficulties } = await supabase
    .from("difficulties")
    .select("skill, area, note")
    .eq("session_id", sessionId);

  const logLines =
    (difficulties || []).map((d) => `${d.skill} | ${d.area} | ${d.note}`).join("\n") ||
    "(nenhuma dificuldade registrada, desempenho consistente)";

  const prompt = `Um estudante de inglês nível CEFR ${session.level} completou uma aula de estudo sobre o tema "${session.topic_title}". Durante a aula foram registradas as seguintes dificuldades (uma por linha, formato skill | área | observação):
${logLines}

Gere um relatório em JSON com esta forma:
{
  "summary": "2-3 frases em português, no tom próximo e humanizado da Unblocking Minds, falando diretamente com o aluno sobre o desempenho geral no nível ${session.level}",
  "bySkill": {
    "reading": {"score": "forte|adequado|a desenvolver", "note": "1 frase em português"},
    "grammar": {"score": "forte|adequado|a desenvolver", "note": "..."},
    "listening": {"score": "forte|adequado|a desenvolver", "note": "..."},
    "speaking": {"score": "forte|adequado|a desenvolver", "note": "..."},
    "writing": {"score": "forte|adequado|a desenvolver", "note": "..."}
  },
  "scores": {
    "reading": número de 0 a 10 (uma casa decimal, ex: 7.5) avaliando o desempenho em leitura nesta aula,
    "grammar": número de 0 a 10 para gramática (desafios de preenchimento de lacunas),
    "listening": número de 0 a 10 para escuta,
    "speaking": número de 0 a 10 para fala,
    "writing": número de 0 a 10 para escrita,
    "overall": número de 0 a 10, média ponderada das cinco notas acima
  },
  "recurringDifficulties": ["área 1", "área 2"],
  "recommendations": ["recomendação prática 1 em português, tom acolhedor e direto", "recomendação 2", "recomendação 3"]
}
Responda apenas o JSON.`;

  let report;
  try {
    report = await askClaude(prompt, UNBLOCKING_VOICE_SYSTEM_PROMPT, {
      operation: "report_generate",
      userId: user.id,
      sessionId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Falha ao gerar relatório" }, { status: 502 });
  }

  const { error: insertErr } = await admin.from("reports").insert({
    session_id: sessionId,
    summary: report.summary,
    by_skill: report.bySkill,
    scores: report.scores,
    recurring_difficulties: report.recurringDifficulties,
    recommendations: report.recommendations,
  });

  if (insertErr) {
    console.error("Falha ao salvar relatório no Supabase:", insertErr);
    return NextResponse.json(
      { error: `Não foi possível salvar o relatório no banco: ${insertErr.message}` },
      { status: 500 }
    );
  }

  await admin
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Atualiza sequência de dias e verifica conquistas. Isso roda depois que
  // a aula já está marcada como concluída, então já entra na contagem.
  const { currentStreak, longestStreak } = await updateStreakOnCompletion(supabase, user.id);
  const unlockedAchievements = await checkAndUnlockAchievements(admin, user.id, {
    currentStreak,
    level: session.level,
    overall: typeof report.scores?.overall === "number" ? report.scores.overall : null,
    bySkill: report.bySkill || {},
  });

  // A cada 10 aulas seguidas avaliadas como "forte" numa habilidade, essa
  // habilidade fica 10% mais desafiadora nas próximas aulas.
  const skillDifficulty = await updateSkillDifficulty(admin, user.id, report.bySkill || {});

  return NextResponse.json({ ...report, streak: { currentStreak, longestStreak }, unlockedAchievements, skillDifficulty });
}

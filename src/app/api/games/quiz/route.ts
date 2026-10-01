import { NextResponse } from "next/server";
import { askClaude, HAIKU_MODEL } from "@/lib/claude";
import { supabaseServer } from "@/lib/supabase-server";
import { requireActiveUser } from "@/lib/require-active-user";
import { embaralharQuestoes } from "@/lib/embaralhar-alternativas";
import { QUIZ_QUESTIONS, QUIZ_POINTS_PER_QUESTION } from "@/lib/games";

// Quiz dos Games: perguntas rápidas de múltipla escolha, no nível CEFR do
// aluno. Usa o Haiku (mais barato) — é um conteúdo curto e de formato
// simples, como a avaliação de fala e escrita, sem o peso de uma aula.
export async function POST() {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { data: profile } = await supabase.from("profiles").select("default_level").eq("id", check.userId).single();
  const level = profile?.default_level;
  if (!level) {
    return NextResponse.json(
      { error: "Seu nível ainda não foi definido por um administrador. Fale com a administração do +Unblocking." },
      { status: 400 }
    );
  }

  const prompt = `Crie um quiz rápido de inglês com ${QUIZ_QUESTIONS} perguntas de múltipla escolha para um estudante nível CEFR ${level}.
Misture os tipos: vocabulário do dia a dia, expressões e phrasal verbs comuns, gramática em contexto, e curiosidades culturais de países de língua inglesa. Tudo calibrado para o nível ${level}: nem trivial, nem fora de alcance.

Gere um objeto JSON com exatamente esta forma:
{
  "questions": [
    {"q": "pergunta em inglês", "options": ["a","b","c","d"], "answerIndex": 0, "explanation": "1 frase em português, tom acolhedor, explicando por que a certa é a certa, sem travessão"}
  ] (exatamente ${QUIZ_QUESTIONS} perguntas, com 4 alternativas cada)
}

REGRAS PARA AS ALTERNATIVAS:
- As quatro com tamanho, categoria gramatical e registro parecidos. A correta não pode ser identificável por ser a mais longa ou a mais detalhada.
- As erradas erram por um motivo claro e plausível para quem está no nível ${level}. Exatamente uma alternativa é defendível.
- Nada de pegadinha, negativas duplas, "todas as anteriores" ou "nenhuma das anteriores".

Responda apenas o JSON.`;

  let generated: any;
  try {
    generated = await askClaude(prompt, undefined, { operation: "game_quiz", userId: check.userId }, HAIKU_MODEL);
  } catch (e: any) {
    console.error("[games/quiz] falha ao gerar quiz:", e?.message);
    return NextResponse.json({ error: "Não foi possível montar o quiz agora. Tente de novo em alguns instantes." }, { status: 502 });
  }

  // Só passam perguntas bem formadas — uma pergunta quebrada travaria a
  // partida no meio. E a resposta certa vai embaralhada, pelo mesmo motivo
  // das aulas: o modelo tende a escrever a correta sempre primeiro.
  const questions = embaralharQuestoes(
    (Array.isArray(generated?.questions) ? generated.questions : []).filter(
      (q: any) =>
        typeof q?.q === "string" &&
        Array.isArray(q?.options) &&
        q.options.length >= 2 &&
        typeof q?.answerIndex === "number" &&
        q.answerIndex >= 0 &&
        q.answerIndex < q.options.length
    )
  ).slice(0, QUIZ_QUESTIONS);

  if (questions.length === 0) {
    return NextResponse.json({ error: "Não foi possível montar o quiz agora. Tente de novo em alguns instantes." }, { status: 502 });
  }

  return NextResponse.json({ level, questions, pointsPerQuestion: QUIZ_POINTS_PER_QUESTION });
}

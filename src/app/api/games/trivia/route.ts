import { NextResponse } from "next/server";
import { askClaude, HAIKU_MODEL } from "@/lib/claude";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";
import { embaralharQuestoes } from "@/lib/embaralhar-alternativas";
import { TRIVIA_QUESTIONS, TRIVIA_POINTS_PER_QUESTION } from "@/lib/games";

// Trivia: cultura geral (geografia, ciência, história, arte, esportes,
// natureza...), com as perguntas escritas em inglês no nível do aluno. Difere
// do Quiz, que é sobre a própria língua. Usa o Haiku, como os outros games.
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

  // Perguntas das últimas partidas, para não repetir. Se a tabela de
  // pontuação não existir ainda, o erro é ignorado e só se perde essa memória.
  const { data: recent } = await supabaseAdmin()
    .from("game_scores")
    .select("detail")
    .eq("user_id", check.userId)
    .eq("game", "trivia")
    .order("created_at", { ascending: false })
    .limit(3);
  const seen = (recent || []).flatMap((r: any) => (Array.isArray(r?.detail?.seen) ? r.detail.seen : [])).filter((x: any) => typeof x === "string");

  const prompt = `Crie um jogo de trivia de CULTURA GERAL com ${TRIVIA_QUESTIONS} perguntas de múltipla escolha, escritas em inglês simples para um estudante nível CEFR ${level} (vocabulário e estrutura de frase compatíveis com o nível, mesmo que o assunto seja difícil).
Varie bastante os temas: geografia, ciência, história, natureza e animais, corpo humano, arte e música, cinema e TV, esportes, comida, tecnologia, literatura, invenções. No máximo 2 perguntas por tema.
Misture fáceis e médias; todas devem ter uma resposta factual, indiscutível e que não mude com o tempo. Evite política atual, religião, violência e qualquer assunto polêmico.
${seen.length > 0 ? `Não repita estas perguntas nem o assunto delas, que o aluno já jogou: ${seen.join(" | ")}\n` : ""}
Gere um objeto JSON com exatamente esta forma:
{
  "questions": [
    {"q": "pergunta em inglês", "category": "tema em português, 1 ou 2 palavras", "options": ["a","b","c","d"], "answerIndex": 0, "explanation": "1 a 2 frases em português, tom acolhedor, com a resposta certa e uma curiosidade, sem travessão"}
  ] (exatamente ${TRIVIA_QUESTIONS} perguntas, com 4 alternativas cada)
}

REGRAS PARA AS ALTERNATIVAS:
- As quatro do mesmo tipo (todas cidades, todos anos, todos animais) e com tamanho parecido. A correta não pode se destacar por ser mais longa ou mais detalhada.
- Exatamente uma alternativa é correta. As erradas são plausíveis, mas claramente erradas para quem sabe o assunto.
- Nada de "todas as anteriores" ou "nenhuma das anteriores".

Responda apenas o JSON.`;

  let generated: any;
  try {
    generated = await askClaude(prompt, undefined, { operation: "game_trivia", userId: check.userId }, HAIKU_MODEL);
  } catch (e: any) {
    console.error("[games/trivia] falha ao gerar trivia:", e?.message);
    return NextResponse.json({ error: "Não foi possível montar o trivia agora. Tente de novo em alguns instantes." }, { status: 502 });
  }

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
  ).slice(0, TRIVIA_QUESTIONS);

  if (questions.length === 0) {
    return NextResponse.json({ error: "Não foi possível montar o trivia agora. Tente de novo em alguns instantes." }, { status: 502 });
  }

  return NextResponse.json({ level, questions, pointsPerQuestion: TRIVIA_POINTS_PER_QUESTION });
}

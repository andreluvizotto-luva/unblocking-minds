import { NextResponse } from "next/server";
import { askClaude, UNBLOCKING_VOICE_SYSTEM_PROMPT } from "@/lib/claude";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { sessionId, level, prompt: taskPrompt, text } = await req.json();

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const prompt = `Um estudante de inglês nível CEFR ${level} recebeu esta consigna de escrita: "${taskPrompt}"
Texto do estudante:
"""
${text}
"""

Avalie e retorne JSON:
{
  "annotatedIssues": [ {"original": "trecho original", "issue": "explicação curta em português", "suggestion": "correção em inglês"} ],
  "structureNote": "nota curta em português sobre organização/coesão do texto",
  "vocabularyNote": "nota curta em português sobre vocabulário usado",
  "correctedVersion": "versão corrigida e natural do texto completo em inglês",
  "difficulties": [ {"area": "categoria curta em português, ex: 'tempos verbais', 'preposições', 'concordância', 'coesão'", "note": "descrição curta em português"} ]
}
Responda apenas o JSON.`;

  let feedback;
  try {
    feedback = await askClaude(prompt, UNBLOCKING_VOICE_SYSTEM_PROMPT, {
      operation: "writing_evaluate",
      userId: user.id,
      sessionId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Falha ao avaliar texto" }, { status: 502 });
  }

  if (sessionId && feedback.difficulties?.length) {
    await supabase.from("difficulties").insert(
      feedback.difficulties.map((d: any) => ({
        session_id: sessionId,
        skill: "Escrita",
        area: d.area,
        note: d.note,
      }))
    );
  }

  return NextResponse.json(feedback);
}

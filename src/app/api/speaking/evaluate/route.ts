import { NextResponse } from "next/server";
import { askClaude, UNBLOCKING_VOICE_SYSTEM_PROMPT } from "@/lib/claude";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { sessionId, level, prompt: taskPrompt, targetPoints, transcript } = await req.json();

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const prompt = `Um estudante de inglês nível CEFR ${level} recebeu esta consigna de fala: "${taskPrompt}"
Pontos que a resposta deveria cobrir: ${JSON.stringify(targetPoints)}
Transcrição (via reconhecimento de voz, pode ter pequenos erros de transcrição) do que o estudante falou:
"${transcript}"

Avalie e retorne JSON:
{
  "grammarIssues": ["erro gramatical específico, em português explicando + exemplo"],
  "pronunciationNote": "nota curta em português sobre padrões prováveis de pronúncia, baseada no texto transcrito (sem exagerar certeza, já que é transcrição automática)",
  "fluencyNote": "nota curta em português sobre fluência/estrutura da resposta",
  "coverage": "quais pontos-alvo foram cobertos, em português",
  "correctedVersion": "uma versão corrigida e natural em inglês do que o estudante tentou dizer",
  "difficulties": [ {"area": "categoria curta em português, ex: 'tempos verbais', 'concordância', 'vocabulário'", "note": "descrição curta em português"} ]
}
Responda apenas o JSON.`;

  let feedback;
  try {
    feedback = await askClaude(prompt, UNBLOCKING_VOICE_SYSTEM_PROMPT);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Falha ao avaliar fala" }, { status: 502 });
  }

  if (sessionId && feedback.difficulties?.length) {
    await supabase.from("difficulties").insert(
      feedback.difficulties.map((d: any) => ({
        session_id: sessionId,
        skill: "Fala",
        area: d.area,
        note: d.note,
      }))
    );
  }

  return NextResponse.json(feedback);
}

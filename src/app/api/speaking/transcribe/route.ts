import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireActiveUser } from "@/lib/require-active-user";

// Transcreve o áudio gravado no bloco de Fala via OpenAI (gpt-transcribe;
// antes foram o whisper-1 e o gpt-4o-transcribe).
// Substitui a antiga SpeechRecognition do navegador — que simplesmente não
// existe em nenhum navegador no iOS — por gravação de áudio (MediaRecorder,
// suportado em PC, iOS e Android) enviada aqui para virar texto.
export async function POST(req: Request) {
  // Diferente das outras rotas que gastam API, esta nunca tinha nenhuma
  // checagem de autenticação — qualquer um com a URL conseguia transcrever
  // áudio pela conta da OpenAI do projeto, logado ou não.
  const check = await requireActiveUser(await supabaseServer());
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor. Adicione-a ao .env.local e reinicie o app." },
      { status: 500 }
    );
  }

  let incomingForm: FormData;
  try {
    incomingForm = await req.formData();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const audio = incomingForm.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "Áudio ausente" }, { status: 400 });
  }

  const filename = (audio as any).name || "speech.webm";
  const forwardForm = new FormData();
  forwardForm.append("file", audio, filename);
  // gpt-transcribe é o modelo que a OpenAI recomenda hoje para áudio gravado e
  // substitui o gpt-4o-transcribe (desligamento em 26/02/2027). Como o anterior,
  // é um modelo de linguagem e tende a "arrumar" a frase. Aqui a transcrição é
  // usada para conferir a pronúncia e a gramática do aluno (compareSpoken e
  // /api/speaking/evaluate), então uma frase corrigida daria nota alta para um
  // erro real — daí o prompt pedindo transcrição literal. A resposta continua
  // vindo em JSON com { text } (e agora também { languages }, que ignoramos).
  // Atenção: no gpt-transcribe o idioma vai em "languages[]" (lista); o campo
  // singular "language" foi substituído e não deve ser enviado junto.
  forwardForm.append("model", "gpt-transcribe");
  forwardForm.append("languages[]", "en");
  forwardForm.append(
    "prompt",
    "An English learner speaking. Transcribe exactly what is said, word for word, keeping grammar mistakes, " +
      "wrong words, repetitions and unfinished sentences. Do not correct or complete anything."
  );

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: forwardForm,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json({ error: `Falha ao transcrever (OpenAI): ${errText}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ transcript: data.text || "" });
}

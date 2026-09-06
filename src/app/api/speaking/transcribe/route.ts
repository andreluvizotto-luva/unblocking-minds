import { NextResponse } from "next/server";

// Transcreve o áudio gravado no bloco de Fala via OpenAI Whisper.
// Substitui a antiga SpeechRecognition do navegador — que simplesmente não
// existe em nenhum navegador no iOS — por gravação de áudio (MediaRecorder,
// suportado em PC, iOS e Android) enviada aqui para virar texto.
export async function POST(req: Request) {
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
  forwardForm.append("model", "whisper-1");
  forwardForm.append("language", "en");

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

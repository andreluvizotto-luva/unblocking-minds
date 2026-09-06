import { NextResponse } from "next/server";

// Vozes disponíveis na API de TTS da OpenAI.
const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// Gera o áudio (mp3) do texto do listening no servidor via OpenAI TTS.
// Isso substitui a antiga narração via speechSynthesis do navegador — que
// tinha qualidade/voz inconsistente entre PC, iOS e Android — por um único
// áudio gerado uma vez e tocado com <audio>, que funciona igual em qualquer
// dispositivo. A voz é escolhida de forma determinística a partir do
// "voiceSeed" (o id da aula), então cada aula soa com uma voz
// diferente, mas consistente do início ao fim daquela mesma aula.
export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor. Adicione-a ao .env.local e reinicie o app." },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const text = body?.text;
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Texto ausente" }, { status: 400 });
  }

  // Quando o front já escolheu a voz (ex: aulas de Escuta comparativas, que
  // precisam de duas vozes diferentes e coerentes com o gênero de cada
  // personagem — ver pickComparisonVoices em SkillBlocks.tsx), usamos essa
  // voz diretamente em vez de derivar do voiceSeed.
  const requestedVoice = typeof body?.voice === "string" ? body.voice : null;
  const voice =
    requestedVoice && OPENAI_VOICES.includes(requestedVoice)
      ? requestedVoice
      : OPENAI_VOICES[hashSeed(String(body?.voiceSeed || "default")) % OPENAI_VOICES.length];

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input: text,
      speed: 0.95,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json({ error: `Falha ao gerar áudio (OpenAI): ${errText}` }, { status: 502 });
  }

  const audioBuffer = await res.arrayBuffer();
  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

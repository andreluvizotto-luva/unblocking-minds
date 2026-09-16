import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Vozes disponíveis na API de TTS da OpenAI.
const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

// Bucket de Storage onde o áudio já gerado fica em cache (ver
// criar-bucket-tts-audio.sql). Sem policy de RLS pra authenticated/anon —
// só o backend, com service_role, lê e escreve aqui.
const TTS_BUCKET = "tts-audio";

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

  // sessionId + variant identificam de forma estável "este áudio exato" —
  // o conteúdo da aula (sessions.content) nunca é editado depois de criado,
  // então o mesmo texto sempre vai gerar o mesmo áudio para a mesma aula.
  // Cache é opcional: sem sessionId (ou variant fora do formato esperado),
  // a rota se comporta como antes, gerando na OpenAI sem guardar nada.
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const variant = typeof body?.variant === "string" && /^[a-z0-9]{1,20}$/.test(body.variant) ? body.variant : null;
  const cachePath = sessionId && variant ? `${sessionId}/${variant}.mp3` : null;

  if (cachePath) {
    // A aula pertence a um aluno específico — antes de servir (ou gravar)
    // um áudio em cache, confirma que quem está pedindo é o dono da sessão.
    // Sem isso, um aluno poderia adivinhar o sessionId de outro e ouvir
    // conteúdo de aula que não é dele.
    const supabase = supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const { data: session } = await supabase.from("sessions").select("id").eq("id", sessionId).single();
    if (!session) {
      return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
    }

    const { data: cached } = await supabaseAdmin().storage.from(TTS_BUCKET).download(cachePath);
    if (cached) {
      const cachedBuffer = await cached.arrayBuffer();
      return new NextResponse(cachedBuffer, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          // O áudio de uma aula já criada nunca muda — pode ficar em cache
          // no navegador também, não só no servidor.
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }
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

  if (cachePath) {
    // Guarda para a próxima montagem do bloco não precisar gerar de novo.
    // Falha ao subir pro Storage não pode derrubar a resposta ao aluno —
    // o áudio já foi gerado e é isso que importa nesta chamada.
    supabaseAdmin()
      .storage.from(TTS_BUCKET)
      .upload(cachePath, audioBuffer, { contentType: "audio/mpeg", upsert: true })
      .then(({ error }) => {
        if (error) console.error("[tts/generate] falha ao gravar cache (ignorado):", error.message);
      })
      .catch((e: any) => console.error("[tts/generate] falha ao gravar cache (ignorado):", e?.message));
  }

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": cachePath ? "private, max-age=31536000, immutable" : "no-store",
    },
  });
}

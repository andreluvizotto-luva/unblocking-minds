import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";

// Vozes disponíveis na API de TTS da OpenAI. O gpt-4o-mini-tts aceita mais
// vozes (ash, coral, sage, marin, cedar…), mas mantemos as seis de sempre
// porque o SkillBlocks.tsx as separa por gênero para as aulas comparativas.
const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

// Modelo de TTS. Saímos do tts-1 para o gpt-4o-mini-tts, que soa mais natural
// e aceita "instructions" (tom e ritmo). Atenção: a OpenAI marcou os dois como
// descontinuados, com desligamento em 06/01/2027 — o substituto indicado só
// existe na Realtime API, então esta rota vai precisar ser revista até lá.
const TTS_MODEL = "gpt-4o-mini-tts";

// Orientação de leitura para quem está aprendendo inglês. O tts-1 não tinha
// isso; o "speed" continua, mas o ritmo agora é guiado principalmente aqui.
const TTS_INSTRUCTIONS =
  "You are reading a listening exercise for Brazilian students learning English. " +
  "Speak in a clear, natural and friendly tone, at a slightly slower pace than normal conversation, " +
  "pronouncing every word distinctly. Do not add, skip or change any words.";

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
  // Provedor do TTS. A OpenAI desliga o gpt-4o-mini-tts em 06/01/2027 e o
  // sucessor indicado (gpt-realtime-2.1-mini) só existe na Realtime API, que
  // não garante ler o texto palavra por palavra — e a Escuta precisa do texto
  // exato da aula, porque as perguntas são sobre ele. Por isso a troca é para
  // o Google Cloud Text-to-Speech, feito para ler texto literal. Enquanto
  // GOOGLE_TTS_API_KEY não estiver configurada, segue tudo na OpenAI como antes:
  // dá para fazer o deploy deste código sem mudar nada e trocar só pela variável.
  const googleKey = process.env.GOOGLE_TTS_API_KEY;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!googleKey && !apiKey) {
    return NextResponse.json(
      { error: "Nenhuma chave de TTS configurada no servidor (GOOGLE_TTS_API_KEY ou OPENAI_API_KEY)." },
      { status: 500 }
    );
  }

  const supabase = await supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
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

  let audioBuffer: ArrayBuffer;
  try {
    audioBuffer = googleKey ? await synthesizeGoogle(googleKey, text, voice) : await synthesizeOpenAI(apiKey!, text, voice);
  } catch (e: any) {
    return NextResponse.json({ error: `Falha ao gerar áudio: ${e?.message || e}` }, { status: 502 });
  }

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

async function synthesizeOpenAI(apiKey: string, text: string, voice: string): Promise<ArrayBuffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions: TTS_INSTRUCTIONS,
      speed: 0.95,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }
  return res.arrayBuffer();
}

// O front continua escolhendo a voz pelos nomes da OpenAI (SkillBlocks.tsx os
// separa por gênero para as aulas comparativas). Aqui cada nome vira uma voz
// Neural2 do Google do mesmo gênero, para não precisar mexer no front nem no
// cache: áudios já gravados no Storage continuam valendo para as aulas antigas.
const GOOGLE_VOICES: Record<string, string> = {
  echo: "en-US-Neural2-D",
  onyx: "en-US-Neural2-J",
  fable: "en-US-Neural2-A",
  nova: "en-US-Neural2-F",
  shimmer: "en-US-Neural2-H",
  alloy: "en-US-Neural2-C",
};

async function synthesizeGoogle(apiKey: string, text: string, voice: string): Promise<ArrayBuffer> {
  // O Google limita a 5.000 bytes de texto por pedido. Os textos de Escuta
  // ficam bem abaixo disso; se um dia passar, o erro volta como 502 e o bloco
  // mostra o aviso de falha em vez de travar a aula.
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "en-US", name: GOOGLE_VOICES[voice] || GOOGLE_VOICES.alloy },
      // Um pouco mais devagar que a fala normal, como a orientação que o
      // gpt-4o-mini-tts recebia (TTS_INSTRUCTIONS) para quem está aprendendo.
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error("Google não devolveu áudio");
  const buf = Buffer.from(data.audioContent, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

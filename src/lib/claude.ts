import { supabaseAdmin } from "./supabase-admin";

// Ponte única com a API da Claude. Roda SOMENTE no servidor (rotas /api),
// nunca é importado por um componente de cliente — é por isso que a
// ANTHROPIC_API_KEY pode ficar em variável de ambiente com segurança.

const SYSTEM_PROMPT =
  "Você é um planejador de currículo de inglês como língua estrangeira. " +
  "Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois.";

// Voz usada especificamente em feedbacks e relatórios entregues ao aluno,
// o tom próximo e humanizado da Unblocking Minds (metodologia da Miss Gaspar Andrea).
export const UNBLOCKING_VOICE_SYSTEM_PROMPT =
  "Você escreve feedbacks e relatórios de aprendizado de inglês na voz da Unblocking Minds, " +
  "a metodologia da educadora Miss Gaspar Andrea: um tom próximo, humano e acolhedor, como uma " +
  "professora real que está ali por perto, não um sistema automático e frio. Fale diretamente com " +
  "o aluno usando 'você', com frases curtas, honestas e calorosas. Trate erros como parte natural " +
  "do processo de desbloquear a fala espontânea ('erro é semente, não falha'), nunca com tom " +
  "punitivo ou de reprovação. Reconheça o esforço e a coragem de praticar e de falar em voz alta, " +
  "mesmo quando o desempenho ainda está longe do ideal. Seja específico e realmente útil nas " +
  "correções, nunca vago ou genérico, mas sempre com gentileza e presença. Evite jargão técnico " +
  "ou corporativo. Use uma linguagem simples e fluida, com frases que fluem naturalmente uma na " +
  "outra, como numa conversa. Prefira ponto final, vírgula ou 'e'/'mas'/'porque' para ligar ideias. " +
  "NUNCA use travessão (—) nem hífen como pontuação (' - ') dentro das frases. Seja formal o " +
  "suficiente para transmitir confiança, mas sem soar rígido ou burocrático. Quando fizer sentido, " +
  "feche com uma frase curta de encorajamento, no espírito de 'respire, fale, desbloqueie', sem " +
  "exagerar no otimismo nem soar artificial. " +
  "Responda SOMENTE com JSON válido, no formato exato pedido, sem markdown, sem texto antes ou depois.";

// Uma aula completa (leitura, comparação, escuta, gramática, fala e escrita)
// gera um JSON grande — nos níveis mais altos, ainda maior, porque os textos
// e os distratores ficam mais longos. Com um teto baixo a resposta chegava
// cortada no meio e o JSON.parse quebrava com um erro incompreensível na
// tela do aluno ("Expected ',' or ']' after array element..."). Este teto
// dá folga confortável para o caso mais pesado (C1/C2 com dificuldade
// adaptativa acumulada).
const MAX_TOKENS = 8000;

// Contexto para registrar quanto cada operação consumiu. Opcional: sem ele
// a chamada funciona igual, só não é contabilizada.
export type UsoMeta = {
  operation: "session_generate" | "report_generate" | "speaking_evaluate" | "writing_evaluate";
  userId: string;
  sessionId?: string | null;
};

// Grava o consumo de uma chamada. Registra CADA chamada à API, inclusive as
// que falharam no parse e foram repetidas — a tentativa perdida também é
// cobrada, e escondê-la daria um custo menor que o real. Duas linhas com o
// mesmo operation e horário próximo significam que houve repetição.
//
// Nunca deixa a aula quebrar por causa do registro: qualquer erro aqui é
// engolido de propósito. Contabilidade não pode derrubar o produto.
async function registrarUso(meta: UsoMeta | undefined, data: any) {
  if (!meta || !data?.usage) return;
  try {
    await supabaseAdmin().from("token_usage").insert({
      user_id: meta.userId,
      session_id: meta.sessionId ?? null,
      operation: meta.operation,
      model: data.model ?? null,
      input_tokens: data.usage.input_tokens ?? 0,
      output_tokens: data.usage.output_tokens ?? 0,
    });
  } catch (e: any) {
    console.error("[registrarUso] falha ao gravar consumo (ignorado):", e?.message);
  }
}

async function callClaude(prompt: string, system: string, apiKey: string, meta?: UsoMeta) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API da Claude (${res.status}): ${errText}`);
  }

  const data = await res.json();
  await registrarUso(meta, data);

  const text = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  return { text, stopReason: data.stop_reason as string | undefined };
}

export async function askClaude(prompt: string, system?: string, meta?: UsoMeta) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor (.env.local)");
  }

  const systemPrompt = system || SYSTEM_PROMPT;
  let ultimoErro = "";

  // Duas tentativas: a geração é probabilística, então um JSON malformado
  // por acaso (uma aspa não escapada, uma vírgula faltando) normalmente
  // desaparece ao repetir. Só falha de verdade se as duas quebrarem.
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const { text, stopReason } = await callClaude(prompt, systemPrompt, apiKey, meta);

    if (stopReason === "max_tokens") {
      ultimoErro = `resposta truncada no limite de ${MAX_TOKENS} tokens`;
      console.error(`[askClaude] tentativa ${tentativa}: ${ultimoErro}`);
      continue;
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e: any) {
      ultimoErro = e.message;
      // Loga o trecho ao redor do ponto que quebrou — sem isso não há como
      // diagnosticar o que a IA devolveu de errado.
      const pos = Number(cleaned.match(/position (\d+)/)?.[1] ?? 0);
      console.error(
        `[askClaude] tentativa ${tentativa}: JSON inválido (${e.message}). ` +
          `Tamanho: ${cleaned.length} chars. Trecho: ...${cleaned.slice(Math.max(0, pos - 200), pos + 200)}...`
      );
    }
  }

  throw new Error(
    "A IA devolveu uma resposta em formato inesperado e não foi possível montar o conteúdo. " +
      `Tente de novo em alguns instantes. (detalhe técnico: ${ultimoErro})`
  );
}

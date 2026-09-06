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

export async function askClaude(prompt: string, system?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor (.env.local)");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: system || SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API da Claude (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

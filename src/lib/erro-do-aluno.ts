// Traduz uma falha técnica na frase que o aluno de fato lê na tela.
//
// Motivo: o erro cru já vazou para a aula. Um aluno viu, no meio da tela
// inicial, o texto completo 'Erro na API da Claude (400): {"type":"error",
// "error":{"type":"invalid_request_error","message":"Your credit balance is
// too low to access the Anthropic API..."}}' — JSON, status HTTP e request_id
// incluídos. Isso não ajuda o aluno, expõe detalhe de infraestrutura e assusta
// justamente quem só queria estudar.
//
// O detalhe técnico continua existindo: vai inteiro para o console do
// servidor, onde aparece nos logs da Vercel. O que ele não faz mais é chegar
// à tela.

export function mensagemParaOAluno(erro: unknown, contexto: string, padrao: string): string {
  const tecnico = erro instanceof Error ? erro.message : String(erro);
  console.error(`[${contexto}]`, tecnico);

  const t = tecnico.toLowerCase();

  // Conta sem crédito na Anthropic ou na OpenAI. É o único caso em que quem
  // precisa agir é a professora, não o aluno — então a mensagem manda avisar
  // em vez de mandar tentar de novo para sempre.
  if (t.includes("credit balance") || t.includes("insufficient_quota") || t.includes("billing")) {
    return "O aplicativo está temporariamente sem acesso ao serviço que monta as aulas. Avise a professora — não é nada que você tenha feito.";
  }

  // Congestionamento passageiro: aqui tentar de novo resolve mesmo.
  if (t.includes("rate_limit") || t.includes("429") || t.includes("overloaded")) {
    return "O serviço está congestionado neste momento. Espere um minutinho e tente de novo.";
  }

  if (t.includes("timeout") || t.includes("aborted") || t.includes("fetch failed") || t.includes("network")) {
    return "A conexão falhou no meio do caminho. Confira sua internet e tente de novo.";
  }

  return padrao;
}

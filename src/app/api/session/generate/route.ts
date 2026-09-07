import { NextResponse } from "next/server";
import { askClaude } from "@/lib/claude";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSkillDifficulty } from "@/lib/skill-difficulty";

export async function POST(req: Request) {
  const { topicKind } = await req.json();

  if (!topicKind) {
    return NextResponse.json({ error: "topicKind é obrigatório" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // O nível não é mais escolhido pelo aluno — é definido pelo admin no
  // perfil dele. Isso evita que o aluno force um nível diferente do que
  // foi avaliado, e garante que a rota não confie em nada vindo do cliente.
  const { data: levelProfile } = await supabase
    .from("profiles")
    .select("default_level")
    .eq("id", user.id)
    .single();
  const level = levelProfile?.default_level;
  if (!level) {
    return NextResponse.json(
      { error: "Seu nível ainda não foi definido por um administrador. Fale com a administração do +Unblocking." },
      { status: 400 }
    );
  }

  // Dificuldade adaptativa: quanto mais forte e consistente o aluno vai
  // ficando numa habilidade, mais desafiadora ela fica (ver skill-difficulty.ts).
  // Lida via service_role: skill_progress não tem RLS de aluno (só o
  // servidor e o admin escrevem/leem ali), então usamos a chave admin.
  const skillDifficulty = await getSkillDifficulty(supabaseAdmin(), user.id);
  const difficultyNote = (skill: string, label: string) => {
    const pct = skillDifficulty[skill] || 0;
    if (!pct) return "";
    return ` Este aluno já vem demonstrando domínio consistente em ${label}, então deixe esta parte ${pct}% mais desafiadora que o padrão do nível ${level} (vocabulário mais raro, estruturas mais complexas, distratores mais sutis) — mas sem sair do nível CEFR ${level}.`;
  };

  const { data: pastSessions } = await supabase
    .from("sessions")
    .select("topic_title, topic_kind")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const usedTopics = (pastSessions || [])
    .map((s: any) => s.topic_title)
    .filter(Boolean);

  const TOPIC_KIND_GUIDE: Record<string, string> = {
    news: "um assunto atual do momento (evento, tendência ou notícia real e recente)",
    music: "uma música conhecida, seu(sua) artista e o tema da canção",
    biography: "uma pessoa real inspiradora e sua trajetória",
    travel: "uma experiência, destino ou curiosidade real de viagem",
    work: "um tema real sobre carreira, produtividade ou o mundo do trabalho",
    health: "um tema real de saúde física, mental ou bem-estar",
    sports: "um esporte, atleta ou evento esportivo real",
    cooking: "uma receita, prato ou tradição culinária real",
    technology: "uma tecnologia, produto, empresa ou avanço real e atual da área de tech",
    astrology: "um signo, fenômeno astrológico ou tema real de astrologia (horóscopo, mapa astral, trânsitos)",
  };
  const topicGuide = TOPIC_KIND_GUIDE[topicKind] || "um tema real e específico";

  // A partir do nível B1, 20% das aulas trazem uma variação: em vez de um
  // texto único em Leitura e um áudio único em Escuta, o aluno recebe DOIS
  // textos/áudios sobre o mesmo tema (com pontos de vista, ênfases ou
  // detalhes diferentes) e precisa comparar e interpretar as diferenças
  // entre eles — uma habilidade mais avançada que compreensão isolada.
  const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const isAtLeastB1 = CEFR_ORDER.indexOf(level) >= CEFR_ORDER.indexOf("B1");
  const isComparisonLesson = isAtLeastB1 && Math.random() < 0.2;

  const readingSchema = isComparisonLesson
    ? `{
    "isComparison": true,
    "textA": {"label": "rótulo curto em português para o texto A (ex: 'Resenha 1', 'Ponto de vista de um fã')", "text": "texto em inglês, 70-140 palavras, nível ${level}.${difficultyNote("reading", "Leitura")}"},
    "textB": {"label": "rótulo curto em português para o texto B, contrastando com o A (ex: 'Resenha 2', 'Ponto de vista de um crítico')", "text": "texto em inglês, 70-140 palavras, nível ${level}, sobre o MESMO tema do texto A mas com um ponto de vista, ênfase, opinião ou detalhes diferentes — para gerar diferenças reais de comparar.${difficultyNote("reading", "Leitura")}"},
    "questions": [ {"q": "pergunta em inglês", "options": ["a","b","c","d"], "answerIndex": 0, "area": "área específica avaliada, em português, ex: ideia principal, detalhe específico, inferência, comparação de opiniões, vocabulário em contexto"} ] (gere 3 a 4 perguntas; pelo menos 2 delas devem exigir comparar os dois textos — ex: diferenças de opinião, detalhe que só aparece em um deles, tom diferente — e não só entender um texto isolado)
  }`
    : `{
    "text": "texto em inglês, 80-180 palavras, vocabulário e complexidade calibrados para o nível ${level}.${difficultyNote("reading", "Leitura")}",
    "questions": [ {"q": "pergunta em inglês", "options": ["a","b","c","d"], "answerIndex": 0, "area": "área específica avaliada, em português, ex: ideia principal, detalhe específico, inferência, vocabulário em contexto"} ]
  }`;

  const listeningSchema = isComparisonLesson
    ? `{
    "isComparison": true,
    "textA": {"label": "rótulo curto em português para o áudio A", "gender": "\"male\" ou \"female\" — o gênero do personagem/narrador que fala nesse áudio, coerente com quem é essa pessoa no texto", "text": "texto em inglês, 50-100 palavras, para ser narrado por voz sintetizada, nível ${level}.${difficultyNote("listening", "Escuta")}"},
    "textB": {"label": "rótulo curto em português para o áudio B, contrastando com o A", "gender": "\"male\" ou \"female\" — gênero do personagem/narrador do áudio B (pode ser igual ou diferente do áudio A, conforme fizer sentido para o tema)", "text": "texto em inglês, 50-100 palavras, para ser narrado por voz sintetizada, nível ${level}, sobre o MESMO tema do áudio A mas com um ponto de vista, ênfase ou detalhes diferentes.${difficultyNote("listening", "Escuta")}"},
    "questions": [ {"q": "pergunta em inglês", "options": ["a","b","c","d"], "answerIndex": 0, "area": "área específica avaliada, em português, ex: ideia principal, detalhe específico, inferência, comparação de opiniões, vocabulário em contexto"} ] (gere 3 a 4 perguntas; pelo menos 2 delas devem exigir comparar os dois áudios),
    "gapFill": []
  }`
    : `{
    "text": "texto em inglês diferente do de leitura, 60-140 palavras, para ser narrado por voz sintetizada, nível ${level}.${difficultyNote("listening", "Escuta")}",
    "questions": [ {"q": "pergunta em inglês", "options": ["a","b","c","d"], "answerIndex": 0, "area": "área específica avaliada, em português, ex: ideia principal, detalhe específico, inferência, vocabulário em contexto"} ],
    "gapFill": [
      {
        "before": "início de uma frase RETIRADA DO TEXTO ACIMA (\"text\"), até onde entra a lacuna, com o mesmo texto exato do áudio",
        "after": "resto dessa mesma frase, depois da lacuna (pode ser vazio)",
        "options": ["opção a", "opção b", "opção c", "opção d"],
        "answerIndex": 0,
        "area": "o que está sendo avaliado nessa lacuna, em português, ex: palavra-chave, verbo frasal, número, conector"
      }
    ] (gere 2 a 3 itens, com frases extraídas literalmente do texto de listening, para o aluno completar depois de ouvir o áudio)
  }`;

  const prompt = `Crie uma aula diária de estudo de inglês para um estudante nível CEFR ${level}, com base em um assunto do tipo "${topicKind}" (${topicGuide}). Escolha um tema real e específico (nome de pessoa, música, prato, destino ou evento concreto e atual/atemporal, não genérico).
${
  usedTopics.length > 0
    ? `
Temas, personagens, histórias, receitas, dicas ou notícias já usados anteriormente com este aluno em aulas passadas (NÃO repita nenhum deles, nem variações muito próximas. Busque sempre algo novo e diferente):
${usedTopics
        .map((t: string) => `- ${t}`)
        .join("\n")}
`
    : ""
}
Gere um objeto JSON com exatamente esta forma:
{
  "topic": {"kind": "...", "title": "...", "blurb": "1-2 frases de contexto em português, linguagem simples e fluida, sem usar travessão"},
  "reading": ${readingSchema},
  "grammar": {
    "instructions": "1 frase em português explicando a tarefa de preencher lacunas de gramática, sobre o tema do dia",
    "items": [
      {
        "before": "início da frase em inglês, até onde entra a lacuna",
        "after": "resto da frase em inglês, depois da lacuna (pode ser vazio)",
        "options": ["opção a", "opção b", "opção c", "opção d"],
        "answerIndex": 0,
        "area": "ponto gramatical específico avaliado nesse item, em português, ex: passado simples, preposições, artigos, comparativos"
      }
    ] (gere de 4 a 6 itens, cobrindo pontos gramaticais variados e calibrados para o nível ${level}, relacionados ao tema do dia sempre que possível.${difficultyNote("grammar", "Gramática")})
  },
  "listening": ${listeningSchema},
  "speaking": {
    "prompt": "consigna em inglês pedindo para o estudante falar por 30-60s sobre o tema, adequada ao nível ${level}.${difficultyNote("speaking", "Fala")}",
    "targetPoints": ["ponto 1", "ponto 2", "ponto 3"],
    "gapFill": [
      {
        "before": "início de uma frase curta em inglês relacionada ao tema do dia, até onde entra a lacuna",
        "after": "resto da frase, depois da lacuna (pode ser vazio)",
        "answer": "palavra ou expressão curta que completa corretamente a lacuna"
      }
    ] (gere 2 a 3 itens curtos e simples de completar falando em voz alta, calibrados para o nível ${level})
  },
  "writing": {
    "prompt": "consigna em inglês pedindo um texto curto sobre o tema, calibrado ao nível ${level}.${difficultyNote("writing", "Escrita")}",
    "minWords": número
  }
}
Responda apenas o JSON.`;

  let generated;
  try {
    generated = await askClaude(prompt);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Falha ao gerar aula" }, { status: 502 });
  }

  // A aula é gravada com a chave service_role. O aluno continua podendo LER
  // as próprias aulas (a tela de perfil depende disso), mas não pode criar
  // nem alterar nenhuma pela API do Supabase direto do navegador — o que
  // impediria, por exemplo, forjar um nível diferente do definido pelo admin
  // ou fabricar aulas para inflar as estatísticas.
  const { data: session, error } = await supabaseAdmin()
    .from("sessions")
    .insert({
      user_id: user.id,
      level,
      topic_kind: topicKind,
      topic_title: generated.topic?.title,
      topic_blurb: generated.topic?.blurb,
      content: generated,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id, content: generated });
}

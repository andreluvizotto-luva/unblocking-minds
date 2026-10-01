import { NextResponse } from "next/server";
import { askClaude, HAIKU_MODEL } from "@/lib/claude";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";
import { GUESS_CLUES, nameParts, clueRevealsName } from "@/lib/games";

// "Quem é?": uma personalidade conhecida, revelada aos poucos por dicas em
// inglês — da mais difícil para a mais fácil. As dicas são a prática de
// leitura; o nome é só o desafio. Usa o Haiku: conteúdo curto e simples.
export async function POST() {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { data: profile } = await supabase.from("profiles").select("default_level").eq("id", check.userId).single();
  const level = profile?.default_level;
  if (!level) {
    return NextResponse.json(
      { error: "Seu nível ainda não foi definido por um administrador. Fale com a administração do +Unblocking." },
      { status: 400 }
    );
  }

  // Últimas personalidades deste aluno, para não repetir. Se a tabela de
  // pontuação ainda não existir (SQL não rodado), o erro é ignorado e o
  // game segue funcionando, só sem essa memória.
  const { data: recent } = await supabaseAdmin()
    .from("game_scores")
    .select("detail")
    .eq("user_id", check.userId)
    .eq("game", "guess")
    .order("created_at", { ascending: false })
    .limit(15);
  const usedNames = (recent || []).map((r: any) => r?.detail?.name).filter((n: any) => typeof n === "string");

  const prompt = `Escolha uma personalidade mundialmente conhecida (artista, cientista, atleta, escritor, inventor, empreendedor, personagem histórico) para um jogo de adivinhação com um estudante de inglês nível CEFR ${level}.
Evite políticos em atividade, pessoas ligadas a violência ou a polêmicas atuais, e qualquer pessoa pouco conhecida fora de um país só.
${usedNames.length > 0 ? `Não use nenhuma destas, que o aluno já jogou: ${usedNames.join(", ")}.\n` : ""}
Escreva ${GUESS_CLUES} dicas em inglês, no nível ${level}, da MAIS DIFÍCIL para a MAIS FÁCIL. A primeira deve ser vaga (época, área, uma característica), e a última quase entrega a resposta. Nenhuma dica pode conter o nome ou o sobrenome da pessoa.

Gere um objeto JSON com exatamente esta forma:
{
  "name": "nome pelo qual a pessoa é mais conhecida",
  "aliases": ["outras formas aceitas de escrever o nome: só o sobrenome, nome artístico, grafia em português, etc."],
  "clues": ["dica 1 (mais difícil)", "dica 2", "dica 3", "dica 4", "dica 5 (mais fácil)"],
  "reveal": "1-2 frases em português, tom acolhedor, contando quem é a pessoa e por que é conhecida, sem travessão"
}
Responda apenas o JSON.`;

  const falha = () =>
    NextResponse.json({ error: "Não foi possível escolher uma personalidade agora. Tente de novo em alguns instantes." }, { status: 502 });

  // O prompt proíbe o nome nas dicas, mas isso não basta: em teste, a
  // última dica saiu "...a unit of measurement called the Curie" para Marie
  // Curie. Então o servidor descarta toda dica que contém uma parte do nome
  // ou de um apelido. Se sobrarem menos de 3, gera de novo (uma vez só,
  // para não multiplicar o custo).
  let generated: any = null;
  let clues: string[] = [];
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      generated = await askClaude(prompt, undefined, { operation: "game_guess", userId: check.userId }, HAIKU_MODEL);
    } catch (e: any) {
      console.error("[games/guess] falha ao gerar personalidade:", e?.message);
      return falha();
    }
    if (typeof generated?.name !== "string" || !generated.name.trim()) continue;
    const aliases = (Array.isArray(generated.aliases) ? generated.aliases : []).filter((a: any) => typeof a === "string");
    const parts = nameParts(generated.name, aliases);
    clues = (Array.isArray(generated.clues) ? generated.clues : []).filter(
      (c: any) => typeof c === "string" && c.trim() && !clueRevealsName(c, parts)
    );
    if (clues.length >= 3) break;
  }

  if (typeof generated?.name !== "string" || !generated.name.trim() || clues.length < 2) {
    return falha();
  }

  // A resposta vai junto para o navegador: a conferência do palpite é feita
  // lá, sem uma chamada a mais por tentativa. Isso permite a quem abrir as
  // ferramentas de desenvolvedor ver o nome — aceitável num jogo de prática,
  // e o placar salvo é limitado ao máximo da partida de qualquer forma.
  return NextResponse.json({
    level,
    name: generated.name.trim(),
    aliases: (Array.isArray(generated.aliases) ? generated.aliases : []).filter((a: any) => typeof a === "string" && a.trim()),
    clues: clues.slice(0, GUESS_CLUES),
    reveal: typeof generated.reveal === "string" ? generated.reveal : "",
  });
}

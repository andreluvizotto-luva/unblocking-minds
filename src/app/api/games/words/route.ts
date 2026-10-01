import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireActiveUser } from "@/lib/require-active-user";
import { montarRodada } from "@/lib/palavras";

// Palavras: a rodada (7 letras + todas as palavras possíveis) é montada
// aqui com um dicionário local — sem chamada à IA, então não gasta tokens. A
// lista completa vai para o navegador, que confere cada palavra sem uma
// chamada a mais por tentativa; o placar salvo é limitado ao máximo do jogo.
export async function POST() {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const rodada = montarRodada();
  if (!rodada) {
    return NextResponse.json({ error: "Não foi possível sortear as letras agora. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json(rodada);
}

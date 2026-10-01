import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

// Quem se cadastra sozinho (demo) escolhe o próprio nível inicial, para não
// ficar travado esperando o admin. Só vale enquanto o nível está vazio:
// depois disso, trocar continua sendo coisa do admin (o trigger
// protect_admin_only_profile_fields impede o navegador de mudar).
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) return NextResponse.json({ error: check.error }, { status: check.status });

  let level: unknown;
  try {
    level = (await req.json())?.level;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  if (typeof level !== "string" || !LEVELS.includes(level)) {
    return NextResponse.json({ error: "Nível inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .update({ default_level: level })
    .eq("id", check.userId)
    .is("default_level", null)
    .select("default_level")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível salvar o nível." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Seu nível já foi definido." }, { status: 409 });
  return NextResponse.json({ level: data.default_level });
}

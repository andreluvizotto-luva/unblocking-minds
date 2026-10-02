import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const ASK_FIRST_LESSONS = 3;

// Assinante do app escolhe o próprio nível, então nas 3 primeiras aulas
// concluídas o relatório pergunta se foi fácil ou difícil e oferece subir ou
// descer um nível. Alunos Unblocking têm o nível definido pelo admin e não
// entram aqui.
async function eligibility(sessionId: string) {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) return { error: NextResponse.json({ error: check.error }, { status: check.status }) };

  const { data: profile } = await supabase.from("profiles").select("category, default_level").eq("id", check.userId).single();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, created_at")
    .eq("id", sessionId)
    .eq("user_id", check.userId)
    .maybeSingle();

  let ask = false;
  if (profile?.category === "app" && profile.default_level && session?.status === "completed") {
    const { count } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", check.userId)
      .eq("status", "completed")
      .lte("created_at", session.created_at);
    ask = (count ?? 0) <= ASK_FIRST_LESSONS;
  }

  const i = LEVELS.indexOf(profile?.default_level || "");
  return {
    userId: check.userId,
    ask,
    level: profile?.default_level || null,
    up: i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null,
    down: i > 0 ? LEVELS[i - 1] : null,
  };
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") || "";
  if (!sessionId) return NextResponse.json({ ask: false });
  const r = await eligibility(sessionId);
  if ("error" in r) return r.error;
  return NextResponse.json({ ask: r.ask, level: r.level, up: r.up, down: r.down });
}

// Aplica a sugestão: só um passo para cima ou para baixo, e só dentro da
// mesma janela em que a pergunta aparece.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const direction = body?.direction;
  if (!sessionId || (direction !== "up" && direction !== "down")) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const r = await eligibility(sessionId);
  if ("error" in r) return r.error;
  const target = direction === "up" ? r.up : r.down;
  if (!r.ask || !target) return NextResponse.json({ error: "Não é possível trocar o nível agora." }, { status: 409 });

  const { error } = await supabaseAdmin().from("profiles").update({ default_level: target }).eq("id", r.userId);
  if (error) return NextResponse.json({ error: "Não foi possível trocar o nível agora." }, { status: 500 });
  return NextResponse.json({ level: target });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";
import { resetSkillDifficulty } from "@/lib/skill-difficulty";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const ASK_FIRST_LESSONS = 3;

// Ajuste de nível pelo próprio assinante do app, em dois momentos:
//  - nas 3 primeiras aulas concluídas, o relatório pergunta se foi fácil ou
//    difícil e oferece subir ou descer um nível;
//  - quando os desafios sobem 5 vezes (ver report/generate), o perfil
//    guarda um suggested_level e o relatório oferece subir.
// Alunos Unblocking têm o nível definido pelo admin e não entram aqui.
async function eligibility(sessionId: string) {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) return { error: NextResponse.json({ error: check.error }, { status: check.status }) };

  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("category, default_level, suggested_level")
    .eq("id", check.userId)
    .single();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, created_at")
    .eq("id", sessionId)
    .eq("user_id", check.userId)
    .maybeSingle();

  const isApp = profile?.category === "app" && !!profile.default_level;
  let ask = false;
  if (isApp && session?.status === "completed") {
    const { count } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", check.userId)
      .eq("status", "completed")
      .lte("created_at", session.created_at);
    ask = (count ?? 0) <= ASK_FIRST_LESSONS;
  }

  const i = LEVELS.indexOf(profile?.default_level || "");
  const up = i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
  return {
    userId: check.userId,
    ask,
    level: profile?.default_level || null,
    up,
    down: i > 0 ? LEVELS[i - 1] : null,
    suggested: isApp && profile?.suggested_level && profile.suggested_level === up ? up : null,
  };
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") || "";
  if (!sessionId) return NextResponse.json({ ask: false, suggested: null });
  const r = await eligibility(sessionId);
  if ("error" in r) return r.error;
  return NextResponse.json({ ask: r.ask, level: r.level, up: r.up, down: r.down, suggested: r.suggested });
}

// direction: "up"/"down" (pergunta das 3 primeiras aulas), "accept" ou
// "decline" (sugestão depois de 5 aumentos de desafio).
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const direction = body?.direction;
  if (!sessionId || !["up", "down", "accept", "decline"].includes(direction)) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const r = await eligibility(sessionId);
  if ("error" in r) return r.error;
  const admin = supabaseAdmin();

  if (direction === "decline") {
    await admin.from("profiles").update({ suggested_level: null }).eq("id", r.userId);
    return NextResponse.json({ level: r.level });
  }

  let target: string | null = null;
  if (direction === "accept") target = r.suggested;
  else if (r.ask) target = direction === "up" ? r.up : r.down;
  if (!target) return NextResponse.json({ error: "Não é possível trocar o nível agora." }, { status: 409 });

  const { error } = await admin.from("profiles").update({ default_level: target, suggested_level: null }).eq("id", r.userId);
  if (error) return NextResponse.json({ error: "Não foi possível trocar o nível agora." }, { status: 500 });
  if (direction === "accept") await resetSkillDifficulty(admin, r.userId);
  return NextResponse.json({ level: target });
}

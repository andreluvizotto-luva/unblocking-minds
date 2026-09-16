import type { SupabaseClient } from "@supabase/supabase-js";

// Checagem única de "autenticado e aprovado" para rotas que gastam Claude ou
// OpenAI. checkAccessOrRedirect (access-check.ts) faz o equivalente no
// front-end, mas é só UX — sem esta checagem no servidor, um aluno cadastrado
// e nunca aprovado por um admin podia chamar essas rotas direto e gastar API
// de verdade indefinidamente.
export type ActiveUserResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

export async function requireActiveUser(supabase: SupabaseClient): Promise<ActiveUserResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Não autenticado" };

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).single();
  if (profile?.is_active === false) {
    return {
      ok: false,
      status: 403,
      error: "Sua conta ainda não foi liberada por um administrador. Fale com a administração do +Unblocking.",
    };
  }
  return { ok: true, userId: user.id };
}

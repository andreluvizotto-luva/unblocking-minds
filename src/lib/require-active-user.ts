import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCESS_ERROR, ACCESS_SELECT, accessStatus } from "./access";

// Checagem única de "autenticado e com acesso" para rotas que gastam Claude
// ou OpenAI. checkAccessOrRedirect (access-check.ts) faz o equivalente no
// front-end, mas é só UX — sem esta checagem no servidor, quem não tem acesso
// podia chamar essas rotas direto e gastar API de verdade.
export type ActiveUserResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

export async function requireActiveUser(supabase: SupabaseClient): Promise<ActiveUserResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Não autenticado" };

  const { data: profile } = await supabase.from("profiles").select(ACCESS_SELECT).eq("id", user.id).single();
  const status = profile ? accessStatus(profile) : "ok";
  if (status !== "ok") return { ok: false, status: 403, error: ACCESS_ERROR[status] };
  return { ok: true, userId: user.id };
}

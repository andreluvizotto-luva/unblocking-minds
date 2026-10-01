import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCESS_SELECT, accessStatus } from "./access";

// Guard das páginas: se o aluno não tem acesso (conta desabilitada, prazo
// vencido, teste grátis ou assinatura encerrados), redireciona para
// /bloqueado com o motivo. É só UX — a trava real está em
// require-active-user.ts, no servidor. RLS permite que cada usuário leia o
// próprio registro em profiles, então funciona com o cliente normal.
export async function checkAccessOrRedirect(
  supabase: SupabaseClient,
  userId: string,
  router: { push: (path: string) => void }
): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles").select(ACCESS_SELECT).eq("id", userId).single();

  if (!profile) return true; // perfil ainda não criado pelo trigger — deixa passar

  const status = accessStatus(profile);
  if (status === "ok") return true;

  if (typeof window !== "undefined") sessionStorage.setItem("blockReason", status);
  router.push("/bloqueado");
  return false;
}

import type { SupabaseClient } from "@supabase/supabase-js";

// Verifica se a conta do aluno logado está habilitada e com a senha ainda
// válida. Chamado no guard de autenticação das páginas — se bloqueado,
// redireciona para /bloqueado. RLS permite que cada usuário leia seu
// próprio registro em profiles, então isso funciona com o cliente normal
// (sem precisar da service_role key).
export async function checkAccessOrRedirect(
  supabase: SupabaseClient,
  userId: string,
  router: { push: (path: string) => void }
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, approved_at, password_expires_at")
    .eq("id", userId)
    .single();

  if (!profile) return true; // perfil ainda não criado pelo trigger — deixa passar

  if (profile.is_active === false) {
    // Nunca foi aprovado por um admin ainda (conta nova) vs. já foi
    // aprovado antes e depois desabilitado — a mensagem em /bloqueado é
    // diferente para cada caso.
    const reason = profile.approved_at ? "disabled" : "pending";
    if (typeof window !== "undefined") sessionStorage.setItem("blockReason", reason);
    router.push("/bloqueado");
    return false;
  }

  if (profile.password_expires_at && new Date(profile.password_expires_at).getTime() < Date.now()) {
    if (typeof window !== "undefined") sessionStorage.setItem("blockReason", "expired");
    router.push("/bloqueado");
    return false;
  }

  return true;
}

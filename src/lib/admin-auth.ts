import { supabaseServer } from "./supabase-server";

// Confirma que quem está chamando a rota é um usuário autenticado E marcado
// como admin no próprio perfil (a leitura da própria linha é permitida pela
// RLS normal — não precisa da service_role para essa checagem).
export async function requireAdmin() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "Não autenticado" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile?.is_admin) {
    return { ok: false as const, status: 403, error: "Acesso restrito a administradores" };
  }

  return { ok: true as const, user };
}

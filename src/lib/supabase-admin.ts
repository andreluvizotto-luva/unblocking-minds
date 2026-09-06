import { createClient } from "@supabase/supabase-js";

// Cliente com a chave "service_role" do Supabase — ignora RLS de propósito.
// NUNCA importar este arquivo em um componente "use client" nem expor a
// chave no navegador. Só é usado dentro das rotas /api/admin/*, que por sua
// vez verificam antes se quem está chamando é de fato um admin.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Copie a 'service_role key' em Project Settings → API no Supabase e adicione ao .env.local."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

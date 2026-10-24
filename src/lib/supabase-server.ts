import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para uso em route handlers / server components (lê a sessão via cookies).
// Assíncrono desde o Next 15: cookies() passou a devolver uma Promise.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado a partir de um Server Component sem permissão de escrita — ignorar
            // (o proxy renova a sessão a cada request)
          }
        },
      },
    }
  );
}

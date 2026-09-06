import { createBrowserClient } from "@supabase/ssr";

// Cliente para uso em componentes de cliente ("use client")
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

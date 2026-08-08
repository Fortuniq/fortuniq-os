// Browser-side Supabase client, for use inside "use client" components
// (e.g. the search bar, the AI Assistant chat, or any future feature that
// needs to read/write data directly from the browser after page load).
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}

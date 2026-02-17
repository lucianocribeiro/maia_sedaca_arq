import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SetAllCookies } from '@supabase/ssr';

export async function getSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options
              }: Parameters<SetAllCookies>[0][number]) => {
              cookieStore.set(name, value, options);
              }
            );
          } catch {
            // Server Components can be read-only for cookies in some flows.
          }
        }
      }
    }
  );
}

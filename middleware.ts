import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SetAllCookies } from '@supabase/ssr';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = {
  role?: string | null;
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(
            ({
              name,
              value,
              options
            }: Parameters<SetAllCookies>[0][number]) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            }
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAdminRoute) {
    return response;
  }

  let role = resolveRoleFromMetadata(user);

  if (!role) {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle<UserRoleRow>();

    role = normalizeRole(roleRow?.role);
  }

  if (role !== 'admin') {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = '/login';
    deniedUrl.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(deniedUrl);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/clientes/:path*']
};

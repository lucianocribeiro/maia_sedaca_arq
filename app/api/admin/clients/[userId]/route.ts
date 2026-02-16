import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = { role?: string | null };

type UpdatePayload = {
  projectStatus?: string;
  links?: Record<string, string>;
};

const EDITABLE_CATEGORIES = ['DOCUMENTACION', 'PLANOS', 'RENDERS', 'CONTRATOS', 'PAGOS'] as const;

export const runtime = 'nodejs';

async function isAdminRequest() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
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

  return role === 'admin';
}

export async function GET(_request: NextRequest, { params }: { params: { userId: string } }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('client_profiles')
    .select('user_id, client_name, project_status')
    .eq('user_id', params.userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: links, error: linksError } = await supabaseAdmin
    .from('client_links')
    .select('category, url')
    .eq('user_id', params.userId)
    .in('category', [...EDITABLE_CATEGORIES]);

  if (linksError) {
    return NextResponse.json({ error: linksError.message }, { status: 400 });
  }

  return NextResponse.json({ profile, links: links || [] });
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as UpdatePayload;
  const projectStatus = payload.projectStatus?.trim() || null;
  const links = payload.links || {};

  const missing = EDITABLE_CATEGORIES.find((category) => !(links[category] || '').trim());
  if (missing) {
    return NextResponse.json({ error: `Falta el link para ${missing}.` }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { error: updateProfileError } = await supabaseAdmin
    .from('client_profiles')
    .update({ project_status: projectStatus })
    .eq('user_id', params.userId);

  if (updateProfileError) {
    return NextResponse.json({ error: updateProfileError.message }, { status: 400 });
  }

  const { error: deleteLinksError } = await supabaseAdmin
    .from('client_links')
    .delete()
    .eq('user_id', params.userId)
    .in('category', [...EDITABLE_CATEGORIES]);

  if (deleteLinksError) {
    return NextResponse.json({ error: deleteLinksError.message }, { status: 400 });
  }

  const insertRows = EDITABLE_CATEGORIES.map((category) => ({
    user_id: params.userId,
    category,
    url: links[category].trim()
  }));

  const { error: insertLinksError } = await supabaseAdmin.from('client_links').insert(insertRows);

  if (insertLinksError) {
    return NextResponse.json({ error: insertLinksError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = {
  role?: string | null;
};

type CreateClientPayload = {
  email?: string;
  password?: string;
  clientName?: string;
  projectStatus?: string;
  links?: Record<string, string>;
};

const LINK_CATEGORIES = ['DOCUMENTACION', 'PLANOS', 'RENDERS', 'CONTRATOS', 'PAGOS', 'FOTOS'] as const;

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

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('client_profiles')
    .select('user_id, client_name, project_status')
    .order('client_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ clients: data || [] });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as CreateClientPayload;
  const email = payload.email?.trim() || '';
  const password = payload.password?.trim() || '';
  const clientName = payload.clientName?.trim() || '';
  const projectStatus = payload.projectStatus?.trim() || null;
  const links = payload.links || {};

  if (!email || !password || !clientName) {
    return NextResponse.json({ error: 'Email, password y client_name son obligatorios.' }, { status: 400 });
  }

  const missingCategory = LINK_CATEGORIES.find((category) => !(links[category] || '').trim());
  if (missingCategory) {
    return NextResponse.json({ error: `Falta el link para la categoría ${missingCategory}.` }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'client'
    }
  });

  if (createAuthError || !authData.user) {
    return NextResponse.json({ error: createAuthError?.message || 'No se pudo crear el usuario.' }, { status: 400 });
  }

  const userId = authData.user.id;

  const { error: roleInsertError } = await supabaseAdmin.from('user_roles').insert({
    user_id: userId,
    role: 'client'
  });

  if (roleInsertError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: roleInsertError.message }, { status: 400 });
  }

  const { error: profileInsertError } = await supabaseAdmin.from('client_profiles').insert({
    user_id: userId,
    client_name: clientName,
    project_status: projectStatus
  });

  if (profileInsertError) {
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileInsertError.message }, { status: 400 });
  }

  const linkRows = LINK_CATEGORIES.map((category) => ({
    user_id: userId,
    category,
    url: links[category].trim()
  }));

  const { error: linksInsertError } = await supabaseAdmin.from('client_links').insert(linkRows);
  if (linksInsertError) {
    await supabaseAdmin.from('client_profiles').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: linksInsertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = (await request.json()) as { userId?: string };

  if (!userId) {
    return NextResponse.json({ error: 'userId es obligatorio.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { error: linksDeleteError } = await supabaseAdmin.from('client_links').delete().eq('user_id', userId);
  if (linksDeleteError) {
    return NextResponse.json({ error: linksDeleteError.message }, { status: 400 });
  }

  const { error: profileDeleteError } = await supabaseAdmin.from('client_profiles').delete().eq('user_id', userId);
  if (profileDeleteError) {
    return NextResponse.json({ error: profileDeleteError.message }, { status: 400 });
  }

  const { error: roleDeleteError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
  if (roleDeleteError) {
    return NextResponse.json({ error: roleDeleteError.message }, { status: 400 });
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return NextResponse.json({ error: authDeleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

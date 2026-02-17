import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = { role?: string | null };
type ClientProfileRow = {
  id?: string | number | null;
  user_id?: string | null;
  client_name?: string | null;
  project_status?: string | null;
};
type ClientLinkDbRow = {
  link_type?: string | null;
  url?: string | null;
};

type UpdatePayload = {
  projectStatus?: string;
  links?: Record<string, string>;
};

const EDITABLE_CATEGORIES = ['DOCUMENTACION', 'PLANOS', 'RENDERS', 'CONTRATOS', 'PAGOS'] as const;

export const runtime = 'nodejs';

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal server error';
}

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
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('client_profiles')
      .select('id, user_id, client_name, project_status')
      .eq('user_id', params.userId)
      .maybeSingle<ClientProfileRow>();

    if (profileError) {
      return jsonError(profileError.message, 400);
    }
    if (!profile?.id) {
      return jsonError('No se encontró el id interno del cliente.', 404);
    }

    const { data: links, error: linksError } = await supabaseAdmin
      .from('client_links')
      .select('link_type, url')
      .eq('client_id', profile.id)
      .in('link_type', [...EDITABLE_CATEGORIES])
      .returns<ClientLinkDbRow[]>();

    if (linksError) {
      return jsonError(linksError.message, 400);
    }

    return NextResponse.json({
      ok: true,
      profile,
      links: (links || []).map((row) => ({
        category: String(row.link_type || '').trim(),
        url: row.url
      }))
    });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    let payload: UpdatePayload;
    try {
      payload = (await request.json()) as UpdatePayload;
    } catch {
      return jsonError('JSON inválido en el body.', 400);
    }

    const projectStatus = payload.projectStatus?.trim() || null;
    const links = payload.links || {};

    const missing = EDITABLE_CATEGORIES.find((category) => !(links[category] || '').trim());
    if (missing) {
      return jsonError(`Falta el link para ${missing}.`, 400);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: profileRef, error: profileRefError } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .eq('user_id', params.userId)
      .maybeSingle<{ id?: string | number | null }>();

    if (profileRefError) {
      return jsonError(profileRefError.message, 400);
    }
    if (!profileRef?.id) {
      return jsonError('No se encontró el id interno del cliente.', 404);
    }

    const { error: updateProfileError } = await supabaseAdmin
      .from('client_profiles')
      .update({ project_status: projectStatus })
      .eq('user_id', params.userId);

    if (updateProfileError) {
      return jsonError(updateProfileError.message, 400);
    }

    const { error: deleteLinksError } = await supabaseAdmin
      .from('client_links')
      .delete()
      .eq('client_id', profileRef.id)
      .in('link_type', [...EDITABLE_CATEGORIES]);

    if (deleteLinksError) {
      return jsonError(deleteLinksError.message, 400);
    }

    const insertRows = EDITABLE_CATEGORIES.map((category) => ({
      client_id: profileRef.id,
      link_type: category,
      url: links[category].trim()
    }));

    const { error: insertLinksError } = await supabaseAdmin.from('client_links').insert(insertRows);

    if (insertLinksError) {
      return jsonError(insertLinksError.message, 400);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

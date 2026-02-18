import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = {
  role?: string | null;
};
type ClientProfileRefRow = {
  id?: string | number | null;
};
type WeeklyReportPhotoRow = {
  photo_url?: string | null;
};

type CreateClientPayload = {
  email?: string;
  password?: string;
  clientName?: string;
  projectStatus?: string;
  links?: Record<string, string>;
};

const LINK_CATEGORIES = ['DOCUMENTACION', 'PLANOS', 'RENDERS', 'CONTRATOS', 'PAGOS'] as const;
const DEFAULT_LINK_URL = 'https://drive.google.com/';
const REPORTS_BUCKET = 'proyectos';

export const runtime = 'nodejs';

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal server error';
}

function extractProyectosPathFromPublicUrl(url: string) {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return null;
  }

  try {
    const parsed = new URL(normalizedUrl);
    const marker = `/storage/v1/object/public/${REPORTS_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
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

export async function GET() {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('client_profiles')
      .select('id, user_id, client_name, project_status')
      .order('client_name', { ascending: true });

    if (error) {
      return jsonError(error.message);
    }

    return NextResponse.json({ ok: true, clients: data || [] });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    let payload: CreateClientPayload;
    try {
      payload = (await request.json()) as CreateClientPayload;
    } catch {
      return jsonError('JSON inválido en el body.', 400);
    }

    const email = payload.email?.trim() || '';
    const password = payload.password?.trim() || '';
    const clientName = payload.clientName?.trim() || '';
    const projectStatus = payload.projectStatus?.trim() || null;
    const links = payload.links || {};

    if (!email || !password || !clientName) {
      return jsonError('Email, password y client_name son obligatorios.', 400);
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
      return jsonError(createAuthError?.message || 'No se pudo crear el usuario.', 400);
    }

    const userId = authData.user.id;

    const { error: roleInsertError } = await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      role: 'client'
    });

    if (roleInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return jsonError(roleInsertError.message, 400);
    }

    const { error: profileInsertError } = await supabaseAdmin.from('client_profiles').insert({
      user_id: userId,
      client_name: clientName,
      project_status: projectStatus
    });

    if (profileInsertError) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return jsonError(profileInsertError.message, 400);
    }

    const { data: profileRef, error: profileRefError } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle<ClientProfileRefRow>();

    if (profileRefError || profileRef?.id === undefined || profileRef?.id === null) {
      await supabaseAdmin.from('client_profiles').delete().eq('user_id', userId);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return jsonError(profileRefError?.message || 'No se pudo resolver el id interno del cliente.', 400);
    }

    const clientId = profileRef.id;

    const linkRows = LINK_CATEGORIES.map((category) => ({
      client_id: clientId,
      link_type: category,
      url: (links[category] || '').trim() || DEFAULT_LINK_URL
    }));

    const { error: linksInsertError } = await supabaseAdmin.from('client_links').insert(linkRows);
    if (linksInsertError) {
      await supabaseAdmin.from('client_profiles').delete().eq('user_id', userId);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return jsonError(linksInsertError.message, 400);
    }

    return NextResponse.json(
      {
        ok: true,
        client: {
          user_id: userId,
          client_name: clientName,
          project_status: projectStatus
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    let payload: { userId?: string };
    try {
      payload = (await request.json()) as { userId?: string };
    } catch {
      return jsonError('JSON inválido en el body.', 400);
    }

    const userId = payload.userId?.trim();
    if (!userId) {
      return jsonError('userId es obligatorio.', 400);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: profileRef, error: profileRefError } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle<ClientProfileRefRow>();

    if (profileRefError || profileRef?.id === undefined || profileRef?.id === null) {
      return jsonError(profileRefError?.message || 'No se pudo resolver el id interno del cliente.', 400);
    }

    const clientId = String(profileRef.id);
    const { data: reportRows, error: reportRowsError } = await supabaseAdmin
      .from('weekly_reports')
      .select('photo_url')
      .eq('client_id', clientId)
      .returns<WeeklyReportPhotoRow[]>();

    if (reportRowsError) {
      return jsonError(reportRowsError.message, 400);
    }

    const filePaths = Array.from(
      new Set(
        (reportRows || [])
          .map((row) => extractProyectosPathFromPublicUrl(String(row.photo_url || '')))
          .filter((path): path is string => Boolean(path))
      )
    );

    if (filePaths.length > 0) {
      const CHUNK_SIZE = 100;
      for (let index = 0; index < filePaths.length; index += CHUNK_SIZE) {
        const chunk = filePaths.slice(index, index + CHUNK_SIZE);
        const { error: removeError } = await supabaseAdmin.storage.from(REPORTS_BUCKET).remove(chunk);
        if (removeError) {
          return jsonError(removeError.message, 400);
        }
      }
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return jsonError(authDeleteError.message, 400);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

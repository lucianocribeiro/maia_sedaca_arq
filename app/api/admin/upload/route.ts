import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = { role?: string | null };

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

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const formData = await request.formData();
    const userId = String(formData.get('userId') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const file = formData.get('file');

    if (!userId || !description || !(file instanceof File)) {
      return jsonError('Faltan datos para cargar el reporte semanal.', 400);
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return jsonError('Formato inválido. Solo JPG, PNG o WEBP.', 400);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const extension = file.name.toLowerCase().split('.').pop() || 'jpg';
    const filePath = `weekly-reports/${userId}/${Date.now()}.${extension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('proyectos')
      .upload(filePath, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return jsonError(uploadError.message, 400);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('proyectos').getPublicUrl(filePath);

    const { error: reportError } = await supabaseAdmin.from('weekly_reports').insert({
      user_id: userId,
      description,
      photo_url: publicUrlData.publicUrl
    });

    if (reportError) {
      return jsonError(reportError.message, 400);
    }

    return NextResponse.json({
      ok: true,
      report: {
        user_id: userId,
        description,
        photo_url: publicUrlData.publicUrl
      }
    });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

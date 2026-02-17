import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = { role?: string | null };
type LandingSectionPayload = {
  sectionKey?: string;
  sortOrder?: number;
  title?: string | null;
  imageUrl?: string;
};

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

export async function GET() {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('landing_sections')
      .select('section_key, sort_order, title, image_url')
      .order('section_key', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      return jsonError(error.message, 400);
    }

    return NextResponse.json({ ok: true, sections: data || [] });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

async function saveLandingSection(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      let payload: LandingSectionPayload;
      try {
        payload = (await request.json()) as LandingSectionPayload;
      } catch {
        return jsonError('JSON inválido en el body.', 400);
      }

      const sectionKey = String(payload.sectionKey || '').trim().toLowerCase();
      const sortOrder = Number(payload.sortOrder || 1);
      const title = payload.title?.trim() || null;
      const imageUrl = String(payload.imageUrl || '').trim();

      if (!sectionKey || Number.isNaN(sortOrder) || !imageUrl) {
        return jsonError('Faltan datos para actualizar landing_sections.', 400);
      }

      const { error: upsertError } = await supabaseAdmin.from('landing_sections').upsert(
        {
          section_key: sectionKey,
          sort_order: sortOrder,
          title,
          image_url: imageUrl
        },
        { onConflict: 'section_key,sort_order' }
      );

      if (upsertError) {
        return jsonError(upsertError.message, 400);
      }

      return NextResponse.json({ ok: true });
    }

    const formData = await request.formData();
    const sectionKey = String(formData.get('sectionKey') || '').trim().toLowerCase();
    const sortOrder = Number(formData.get('sortOrder') || 1);
    const title = String(formData.get('title') || '').trim() || null;
    const file = formData.get('file');

    if (!sectionKey || Number.isNaN(sortOrder) || !(file instanceof File)) {
      return jsonError('Faltan datos para actualizar landing_sections.', 400);
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return jsonError('Formato inválido. Solo JPG, PNG o WEBP.', 400);
    }

    const extension = file.name.toLowerCase().split('.').pop() || 'jpg';
    const filePath = `landing/${sectionKey}/${sortOrder}-${Date.now()}.${extension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('proyectos')
      .upload(filePath, fileBuffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      return jsonError(uploadError.message, 400);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('proyectos').getPublicUrl(filePath);

    const { error: upsertError } = await supabaseAdmin.from('landing_sections').upsert(
      {
        section_key: sectionKey,
        sort_order: sortOrder,
        title,
        image_url: publicUrlData.publicUrl
      },
      { onConflict: 'section_key,sort_order' }
    );

    if (upsertError) {
      return jsonError(upsertError.message, 400);
    }

    return NextResponse.json({ ok: true, imageUrl: publicUrlData.publicUrl });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

export async function POST(request: NextRequest) {
  return saveLandingSection(request);
}

export async function PATCH(request: NextRequest) {
  return saveLandingSection(request);
}

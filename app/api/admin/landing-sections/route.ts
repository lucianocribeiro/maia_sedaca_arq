import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = { role?: string | null };

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
    .from('landing_sections')
    .select('section_key, sort_order, title, image_url')
    .order('section_key', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ sections: data || [] });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const sectionKey = String(formData.get('sectionKey') || '').trim().toLowerCase();
  const sortOrder = Number(formData.get('sortOrder') || 1);
  const title = String(formData.get('title') || '').trim() || null;
  const file = formData.get('file');

  if (!sectionKey || Number.isNaN(sortOrder) || !(file instanceof File)) {
    return NextResponse.json({ error: 'Faltan datos para actualizar landing_sections.' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Solo JPG o PNG.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const extension = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const filePath = `landing/${sectionKey}/${sortOrder}-${Date.now()}.${extension}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from('proyectos')
    .upload(filePath, fileBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from('proyectos').getPublicUrl(filePath);

  const { error: deleteError } = await supabaseAdmin
    .from('landing_sections')
    .delete()
    .eq('section_key', sectionKey)
    .eq('sort_order', sortOrder);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  const { error: insertError } = await supabaseAdmin.from('landing_sections').insert({
    section_key: sectionKey,
    sort_order: sortOrder,
    title,
    image_url: publicUrlData.publicUrl
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

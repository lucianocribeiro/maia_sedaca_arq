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

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const userId = String(formData.get('userId') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const file = formData.get('file');

  if (!userId || !description || !(file instanceof File)) {
    return NextResponse.json({ error: 'Faltan datos para cargar el reporte semanal.' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Solo JPG o PNG.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const extension = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const filePath = `weekly-reports/${userId}/${Date.now()}.${extension}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from('proyectos')
    .upload(filePath, fileBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from('proyectos').getPublicUrl(filePath);

  const { error: reportError } = await supabaseAdmin.from('weekly_reports').insert({
    user_id: userId,
    description,
    photo_url: publicUrlData.publicUrl
  });

  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

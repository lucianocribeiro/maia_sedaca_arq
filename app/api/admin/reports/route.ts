import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = { role?: string | null };
type ReportBatchPayload = {
  userId?: string;
  description?: string;
  imageUrls?: string[];
};

const PRIMARY_REPORTS_BUCKET = process.env.SUPABASE_REPORTS_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || 'proyectos';
const FALLBACK_REPORTS_BUCKET = 'gallery';

export const runtime = 'nodejs';

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal server error';
}

function isBucketNotFound(message: string) {
  return message.toLowerCase().includes('bucket not found');
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

async function insertWeeklyReports(userId: string, description: string, imageUrls: string[]) {
  const rows = imageUrls.map((photoUrl) => ({
    user_id: userId,
    description,
    photo_url: photoUrl
  }));

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.from('weekly_reports').insert(rows);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, reportsCreated: rows.length };
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = (await request.json()) as ReportBatchPayload;
      const userId = String(payload.userId || '').trim();
      const description = String(payload.description || '').trim();
      const imageUrls = (payload.imageUrls || []).map((url) => String(url || '').trim()).filter(Boolean);

      if (!userId || !description || imageUrls.length === 0) {
        return jsonError('Faltan datos para guardar el reporte semanal.', 400);
      }

      const insertResult = await insertWeeklyReports(userId, description, imageUrls);
      if (!insertResult.ok) {
        return jsonError(insertResult.error, 400);
      }

      return NextResponse.json({
        ok: true,
        reportsCreated: insertResult.reportsCreated
      });
    }

    const formData = await request.formData();
    const userId = String(formData.get('userId') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const multiFiles = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    const legacyFile = formData.get('file');
    const files = multiFiles.length > 0 ? multiFiles : legacyFile instanceof File ? [legacyFile] : [];

    if (!userId || !description || files.length === 0) {
      return jsonError('Faltan datos para cargar el reporte semanal.', 400);
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (files.some((file) => !allowed.includes(file.type))) {
      return jsonError('Formato inválido. Solo JPG, PNG o WEBP.', 400);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const uploadedUrls: string[] = [];

    for (const [index, file] of files.entries()) {
      const extension = file.name.toLowerCase().split('.').pop() || 'jpg';
      const filePath = `weekly-reports/${userId}/${Date.now()}-${index}.${extension}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      let usedBucket = PRIMARY_REPORTS_BUCKET;
      let { error: uploadError } = await supabaseAdmin.storage
        .from(usedBucket)
        .upload(filePath, fileBuffer, { contentType: file.type, upsert: false });

      if (uploadError && isBucketNotFound(uploadError.message) && usedBucket !== FALLBACK_REPORTS_BUCKET) {
        usedBucket = FALLBACK_REPORTS_BUCKET;
        ({ error: uploadError } = await supabaseAdmin.storage
          .from(usedBucket)
          .upload(filePath, fileBuffer, { contentType: file.type, upsert: false }));
      }

      if (uploadError) {
        return jsonError(uploadError.message, 400);
      }

      const { data: publicUrlData } = supabaseAdmin.storage.from(usedBucket).getPublicUrl(filePath);
      uploadedUrls.push(publicUrlData.publicUrl);
    }

    const insertResult = await insertWeeklyReports(userId, description, uploadedUrls);
    if (!insertResult.ok) {
      return jsonError(insertResult.error, 400);
    }

    return NextResponse.json({
      ok: true,
      reportsCreated: insertResult.reportsCreated
    });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, resolveRoleFromMetadata } from '@/lib/auth/roles';

type UserRoleRow = { role?: string | null };
type WeeklyReportRow = {
  id?: string | number | null;
  client_id?: string | number | null;
  photo_url?: string | null;
  description?: string | null;
  report_date?: string | null;
  created_at?: string | null;
};
type ReportBatchPayload = {
  reports?: WeeklyReportInsertPayload[];
  userId?: string;
  description?: string;
  imageUrls?: string[];
};
type WeeklyReportInsertPayload = {
  client_id?: string;
  photo_url?: string;
  description?: string;
  report_date?: string;
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

function extractStoragePathFromPublicUrl(url: string) {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return null;
  }

  try {
    const parsed = new URL(normalizedUrl);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const storagePath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
    const firstSlash = storagePath.indexOf('/');
    if (firstSlash <= 0) {
      return null;
    }

    return {
      bucket: storagePath.slice(0, firstSlash),
      filePath: storagePath.slice(firstSlash + 1)
    };
  } catch {
    return null;
  }
}

async function uploadReportImage({
  userId,
  file
}: {
  userId: string;
  file: File;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const extension = file.name.toLowerCase().split('.').pop() || 'jpg';
  const filePath = `weekly-reports/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
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
    return { ok: false as const, error: uploadError.message };
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(usedBucket).getPublicUrl(filePath);
  return {
    ok: true as const,
    publicUrl: publicUrlData.publicUrl
  };
}

async function removeReportImageByUrl(url: string) {
  const extracted = extractStoragePathFromPublicUrl(url);
  if (!extracted?.bucket || !extracted.filePath) {
    return;
  }

  const supabaseAdmin = getSupabaseAdminClient();
  await supabaseAdmin.storage.from(extracted.bucket).remove([extracted.filePath]);
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

async function insertWeeklyReports(rows: WeeklyReportInsertPayload[]) {
  const supabaseAdmin = getSupabaseAdminClient();
  for (const row of rows) {
    const clientId = String(row.client_id || '').trim();
    const photoUrl = String(row.photo_url || '').trim();
    const description = String(row.description || '').trim();
    const reportDate = String(row.report_date || '').trim();

    if (!clientId || !photoUrl || !description || !reportDate) {
      return { ok: false as const, error: 'Faltan datos para guardar el reporte semanal.' };
    }

    const { error } = await supabaseAdmin.from('weekly_reports').insert({
      client_id: clientId,
      photo_url: photoUrl,
      description,
      report_date: reportDate
    });

    if (error) {
      return { ok: false as const, error: error.message };
    }
  }

  return { ok: true as const, reportsCreated: rows.length };
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const clientId = String(request.nextUrl.searchParams.get('clientId') || '').trim();
    if (!clientId) {
      return jsonError('Falta clientId.', 400);
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('weekly_reports')
      .select('id, client_id, photo_url, description, report_date, created_at')
      .eq('client_id', clientId)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<WeeklyReportRow[]>();

    if (error) {
      return jsonError(error.message, 400);
    }

    return NextResponse.json({
      ok: true,
      reports: (data || []).map((row) => ({
        id: String(row.id || ''),
        client_id: String(row.client_id || ''),
        photo_url: String(row.photo_url || '').trim(),
        description: String(row.description || '').trim(),
        report_date: String(row.report_date || '').trim(),
        created_at: row.created_at || null
      }))
    });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = (await request.json()) as ReportBatchPayload;
      const reports = (payload.reports || []).map((item) => ({
        client_id: String(item.client_id || '').trim(),
        photo_url: String(item.photo_url || '').trim(),
        description: String(item.description || '').trim(),
        report_date: String(item.report_date || '').trim()
      }));

      if (reports.length === 0) {
        return jsonError('Faltan datos para guardar el reporte semanal.', 400);
      }

      const insertResult = await insertWeeklyReports(reports);
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
    const reportDate = String(formData.get('reportDate') || new Date().toISOString().slice(0, 10)).trim();
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
    const { data: profileRef, error: profileRefError } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle<{ id?: string | number | null }>();

    if (profileRefError || profileRef?.id === undefined || profileRef?.id === null) {
      return jsonError(profileRefError?.message || 'No se pudo resolver el client_id.', 400);
    }

    const clientId = String(profileRef.id);

    for (const file of files) {
      const uploaded = await uploadReportImage({ userId, file });
      if (!uploaded.ok) {
        return jsonError(uploaded.error, 400);
      }
      uploadedUrls.push(uploaded.publicUrl);
    }

    const rows = uploadedUrls.map((photoUrl) => ({
      client_id: clientId,
      photo_url: photoUrl,
      description,
      report_date: reportDate
    }));

    const insertResult = await insertWeeklyReports(rows);
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

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const contentType = request.headers.get('content-type') || '';
    const supabaseAdmin = getSupabaseAdminClient();

    if (contentType.includes('application/json')) {
      const payload = (await request.json()) as {
        action?: string;
        clientId?: string;
        fromDescription?: string;
        fromReportDate?: string;
        nextDescription?: string;
        nextReportDate?: string;
      };

      if (payload.action !== 'update_weekly_status') {
        return jsonError('Acción inválida.', 400);
      }

      const clientId = String(payload.clientId || '').trim();
      const fromDescription = String(payload.fromDescription || '').trim();
      const fromReportDate = String(payload.fromReportDate || '').trim();
      const nextDescription = String(payload.nextDescription || '').trim();
      const nextReportDate = String(payload.nextReportDate || '').trim();

      if (!clientId || !fromDescription || !fromReportDate || !nextDescription || !nextReportDate) {
        return jsonError('Faltan datos para editar el reporte semanal.', 400);
      }

      const { data, error } = await supabaseAdmin
        .from('weekly_reports')
        .update({
          description: nextDescription,
          report_date: nextReportDate
        })
        .eq('client_id', clientId)
        .eq('description', fromDescription)
        .eq('report_date', fromReportDate)
        .select('id')
        .returns<Array<{ id?: string | number | null }>>();

      if (error) {
        return jsonError(error.message, 400);
      }
      if (!data || data.length === 0) {
        return jsonError('No se encontró el estado semanal a editar.', 404);
      }

      return NextResponse.json({ ok: true, updated: data.length });
    }

    const formData = await request.formData();
    const action = String(formData.get('action') || '').trim();
    if (action !== 'replace_report_photo') {
      return jsonError('Acción inválida.', 400);
    }

    const reportId = String(formData.get('reportId') || '').trim();
    const userId = String(formData.get('userId') || '').trim();
    const file = formData.get('file');

    if (!reportId || !userId || !(file instanceof File)) {
      return jsonError('Faltan datos para reemplazar la imagen.', 400);
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return jsonError('Formato inválido. Solo JPG, PNG o WEBP.', 400);
    }

    const { data: reportRow, error: reportError } = await supabaseAdmin
      .from('weekly_reports')
      .select('photo_url')
      .eq('id', reportId)
      .maybeSingle<{ photo_url?: string | null }>();

    if (reportError) {
      return jsonError(reportError.message, 400);
    }
    if (!reportRow) {
      return jsonError('No se encontró la foto del reporte.', 404);
    }

    const uploaded = await uploadReportImage({ userId, file });
    if (!uploaded.ok) {
      return jsonError(uploaded.error, 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from('weekly_reports')
      .update({ photo_url: uploaded.publicUrl })
      .eq('id', reportId);

    if (updateError) {
      return jsonError(updateError.message, 400);
    }

    if (reportRow.photo_url) {
      await removeReportImageByUrl(reportRow.photo_url);
    }

    return NextResponse.json({ ok: true, photo_url: uploaded.publicUrl });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return jsonError('Unauthorized', 401);
    }

    const payload = (await request.json()) as {
      action?: string;
      reportId?: string;
      clientId?: string;
      reportDate?: string;
      description?: string;
    };

    const action = String(payload.action || '').trim();
    const supabaseAdmin = getSupabaseAdminClient();

    if (action === 'delete_report_photo') {
      const reportId = String(payload.reportId || '').trim();
      if (!reportId) {
        return jsonError('Falta reportId.', 400);
      }

      const { data: reportRow, error: reportError } = await supabaseAdmin
        .from('weekly_reports')
        .select('id, photo_url')
        .eq('id', reportId)
        .maybeSingle<{ id?: string | number | null; photo_url?: string | null }>();

      if (reportError) {
        return jsonError(reportError.message, 400);
      }
      if (!reportRow?.id) {
        return jsonError('No se encontró la foto del reporte.', 404);
      }

      const { error: deleteError } = await supabaseAdmin.from('weekly_reports').delete().eq('id', reportId);
      if (deleteError) {
        return jsonError(deleteError.message, 400);
      }

      if (reportRow.photo_url) {
        await removeReportImageByUrl(reportRow.photo_url);
      }

      return NextResponse.json({ ok: true, deleted: 1 });
    }

    if (action === 'delete_weekly_status') {
      const clientId = String(payload.clientId || '').trim();
      const reportDate = String(payload.reportDate || '').trim();
      const description = String(payload.description || '').trim();
      if (!clientId || !reportDate || !description) {
        return jsonError('Faltan datos para eliminar el reporte semanal.', 400);
      }

      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('weekly_reports')
        .select('id, photo_url')
        .eq('client_id', clientId)
        .eq('report_date', reportDate)
        .eq('description', description)
        .returns<Array<{ id?: string | number | null; photo_url?: string | null }>>();

      if (rowsError) {
        return jsonError(rowsError.message, 400);
      }

      const ids = (rows || [])
        .map((row) => row.id)
        .filter((id): id is string | number => id !== null && id !== undefined)
        .map((id) => String(id));

      if (ids.length === 0) {
        return jsonError('No se encontró el estado semanal para eliminar.', 404);
      }

      const { error: deleteError } = await supabaseAdmin.from('weekly_reports').delete().in('id', ids);
      if (deleteError) {
        return jsonError(deleteError.message, 400);
      }

      await Promise.all(
        (rows || []).map(async (row) => {
          if (!row.photo_url) {
            return;
          }
          await removeReportImageByUrl(row.photo_url);
        })
      );

      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    return jsonError('Acción inválida.', 400);
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

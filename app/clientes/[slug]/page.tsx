import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { toClientSlug } from '@/lib/auth/roles';
import { ClientProjectDashboard } from '@/components/ClientProjectDashboard';

type ClientPageProps = {
  params: {
    slug: string;
  };
};

type ClientProfileRow = {
  user_id?: string | null;
  client_name?: string | null;
  project_status?: string | null;
};

type ClientLinkRow = {
  category?: string | null;
  url?: string | null;
};

type WeeklyReportRow = {
  id?: string | number | null;
  created_at?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  url?: string | null;
  description?: string | null;
  summary?: string | null;
  notes?: string | null;
};

const RESOURCE_CARDS = [
  { label: 'DOCUMENTACIÓN DE LA OBRA', category: 'DOCUMENTACION' },
  { label: 'PLANOS', category: 'PLANOS' },
  { label: 'RENDERS', category: 'RENDERS' },
  { label: 'CONTRATOS', category: 'CONTRATOS' },
  { label: 'SEGUIMIENTO DE PAGOS', category: 'PAGOS' }
] as const;

export default async function ClientSlugPage({ params }: ClientPageProps) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('client_profiles')
    .select('user_id, client_name, project_status')
    .eq('user_id', user.id)
    .maybeSingle<ClientProfileRow>();

  if (profileError || !profile?.user_id || !profile.client_name) {
    redirect('/login');
  }

  const expectedSlug = toClientSlug(profile.client_name);
  if (!expectedSlug || params.slug !== expectedSlug) {
    redirect('/login');
  }

  const { data: linkRows } = await supabase
    .from('client_links')
    .select('category, url')
    .eq('user_id', user.id)
    .returns<ClientLinkRow[]>();

  const linksByCategory = new Map<string, string>();
  (linkRows || []).forEach((row) => {
    const category = (row.category || '').trim().toUpperCase();
    const url = (row.url || '').trim();
    if (category && url) {
      linksByCategory.set(category, url);
    }
  });

  const cards = RESOURCE_CARDS.map((card) => ({
    title: card.label,
    url: linksByCategory.get(card.category) || null
  }));

  const { data: reportRows } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<WeeklyReportRow[]>();

  const reports = (reportRows || [])
    .map((row, index) => {
      const imageUrl = (row.photo_url || row.image_url || row.url || '').trim();
      if (!imageUrl) {
        return null;
      }

      return {
        id: String(row.id ?? `${row.created_at ?? 'report'}-${index}`),
        imageUrl,
        description: (row.description || row.summary || row.notes || '').trim(),
        createdAt: row.created_at || null
      };
    })
    .filter((report): report is NonNullable<typeof report> => Boolean(report));

  return (
    <ClientProjectDashboard
      clientName={profile.client_name}
      projectStatus={profile.project_status?.trim() || 'Sin estado'}
      cards={cards}
      reports={reports}
    />
  );
}

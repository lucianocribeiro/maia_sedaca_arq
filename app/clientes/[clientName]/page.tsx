import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { toClientSlug } from '@/lib/auth/roles';

type ClientProfile = {
  client_name?: string | null;
};

type ClientPageProps = {
  params: {
    clientName: string;
  };
};

export default async function ClientPage({ params }: ClientPageProps) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle<ClientProfile>();

  if (error || !profile?.client_name) {
    redirect('/login');
  }

  const clientName = profile.client_name.trim();
  const expectedSlug = toClientSlug(clientName);

  if (!expectedSlug) {
    redirect('/login');
  }

  if (params.clientName !== expectedSlug) {
    redirect(`/clientes/${expectedSlug}`);
  }

  return (
    <main className="login-page">
      <section className="login-card" style={{ maxWidth: 760 }}>
        <h1 className="login-title">{clientName}</h1>
        <p className="login-subtitle">
          Área privada de cliente activa. Integrá aquí tus enlaces y documentación personalizada.
        </p>
      </section>
    </main>
  );
}

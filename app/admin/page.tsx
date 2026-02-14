import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AdminImagePanel } from '@/components/AdminImagePanel';
import { resolveRoleFromMetadata } from '@/lib/auth/roles';

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = resolveRoleFromMetadata(user);
  if (role !== 'admin') {
    redirect('/login');
  }

  return (
    <main className="section">
      <div className="container">
        <h1 style={{ marginTop: 0 }}>Panel de administración de imágenes</h1>
        <p style={{ color: 'var(--muted)' }}>Bucket esperado en Supabase Storage: `gallery`.</p>
        <AdminImagePanel />
      </div>
    </main>
  );
}

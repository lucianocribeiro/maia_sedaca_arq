'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { normalizeRole, resolveRoleFromMetadata, toClientSlug, type UserRole } from '@/lib/auth/roles';

type ClientProfile = {
  client_name?: string | null;
  role?: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError('No pudimos iniciar sesión. Intentá nuevamente.');
      setLoading(false);
      return;
    }

    let role: UserRole = resolveRoleFromMetadata(authData.user);
    let clientName: string | null = null;

    const { data: profile, error: profileError } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle<ClientProfile>();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (!role) {
      role = normalizeRole(profile?.role);
    }

    if (profile?.client_name && profile.client_name.trim()) {
      clientName = profile.client_name.trim();
      if (!role) {
        role = 'client';
      }
    }

    if (role === 'admin') {
      router.replace('/admin');
      router.refresh();
      return;
    }

    if (role === 'client' && clientName) {
      const slug = toClientSlug(clientName);
      router.replace(`/clientes/${slug}`);
      router.refresh();
      return;
    }

    setError('Tu usuario no tiene un perfil válido para ingresar.');
    setLoading(false);
    await supabase.auth.signOut();
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <h1 className="login-title">Login</h1>
        <p className="login-subtitle">Ingresá con tu cuenta para continuar.</p>
        <form onSubmit={onSubmit} className="login-form">
          <input
            className="login-input"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
          />
          <input
            className="login-input"
            name="password"
            type="password"
            placeholder="Contraseña"
            autoComplete="current-password"
            required
          />
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          {error ? <p className="login-error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

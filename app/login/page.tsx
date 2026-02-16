'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { normalizeRole, resolveRoleFromMetadata, toClientSlug, type UserRole } from '@/lib/auth/roles';

type ClientProfile = {
  client_name?: string | null;
};

type UserRoleRow = {
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

    let role: UserRole = null;

    const { data: roleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle<UserRoleRow>();

    if (!roleError) {
      role = normalizeRole(roleRow?.role);
    }

    if (!role) {
      role = resolveRoleFromMetadata(authData.user);
    }

    if (role === 'admin') {
      router.replace('/admin/dashboard');
      router.refresh();
      return;
    }

    if (role === 'client') {
      const { data: profile, error: profileError } = await supabase
        .from('client_profiles')
        .select('client_name')
        .eq('user_id', authData.user.id)
        .maybeSingle<ClientProfile>();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      const clientName = profile?.client_name?.trim() || '';
      const slug = toClientSlug(clientName);

      if (!slug) {
        setError('Tu perfil de cliente no tiene un nombre válido.');
        setLoading(false);
        return;
      }

      router.replace(`/clientes/${slug}`);
      router.refresh();
      return;
    }

    setError('No se pudo determinar tu rol de acceso.');
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

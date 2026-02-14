'use client';

import Image from 'next/image';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type StoredImage = {
  name: string;
  publicUrl: string;
};

const BUCKET = 'gallery';

export function AdminImagePanel() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImages = async () => {
    const { data, error: listError } = await supabase.storage.from(BUCKET).list('', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (listError) {
      setError(listError.message);
      return;
    }

    const formatted = (data || [])
      .filter((file) => file.name)
      .map((file) => {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(file.name);
        return {
          name: file.name,
          publicUrl: urlData.publicUrl
        };
      });

    setImages(formatted);
  };

  useEffect(() => {
    void loadImages();
  }, []);

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);

    const fileName = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, file, {
      upsert: false
    });

    if (uploadError) {
      setError(uploadError.message);
      setLoading(false);
      return;
    }

    await loadImages();
    setLoading(false);
    event.target.value = '';
  };

  const removeImage = async (name: string) => {
    setError(null);
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([name]);

    if (removeError) {
      setError(removeError.message);
      return;
    }

    await loadImages();
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: '0.4rem' }}>
          <span>Subir imagen</span>
          <input type="file" accept="image/*" onChange={onUpload} disabled={loading} />
        </label>
        <button type="button" className="button" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

      {error ? <p style={{ margin: 0, color: '#9d2323' }}>{error}</p> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '0.9rem'
        }}
      >
        {images.map((img) => (
          <article
            key={img.name}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              background: 'var(--surface)',
              overflow: 'hidden'
            }}
          >
            <Image src={img.publicUrl} alt={img.name} width={480} height={320} />
            <div style={{ padding: '0.6rem', display: 'grid', gap: '0.4rem' }}>
              <small style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>{img.name}</small>
              <button
                type="button"
                onClick={() => removeImage(img.name)}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  font: 'inherit',
                  cursor: 'pointer',
                  padding: '0.35rem 0.5rem'
                }}
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

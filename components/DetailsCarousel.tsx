'use client';

import { useState } from 'react';

type DetailItem = {
  title: string;
  description: string;
};

type DetailsCarouselProps = {
  items: DetailItem[];
};

export function DetailsCarousel({ items }: DetailsCarouselProps) {
  const [index, setIndex] = useState(0);

  if (!items.length) {
    return null;
  }

  const active = items[index];

  const previous = () => {
    setIndex((current) => (current === 0 ? items.length - 1 : current - 1));
  };

  const next = () => {
    setIndex((current) => (current === items.length - 1 ? 0 : current + 1));
  };

  return (
    <article
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '1.3rem',
        display: 'grid',
        gap: '1rem'
      }}
    >
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        {index + 1} / {items.length}
      </p>
      <h3 style={{ margin: 0 }}>{active.title}</h3>
      <p style={{ margin: 0 }}>{active.description}</p>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" className="button" onClick={previous} aria-label="Detalle anterior">
          ←
        </button>
        <button type="button" className="button" onClick={next} aria-label="Siguiente detalle">
          →
        </button>
      </div>
    </article>
  );
}

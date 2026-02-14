'use client';

import { useMemo, useState } from 'react';

type CarouselItem = {
  src: string;
  alt: string;
  caption?: string;
};

type ImageCarouselProps = {
  items: CarouselItem[];
  variant?: 'projects' | 'details';
};

export function ImageCarousel({ items, variant = 'details' }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);

  const maxIndex = useMemo(() => Math.max(items.length - 1, 0), [items.length]);

  if (!items.length) {
    return null;
  }

  const previous = () => {
    setIndex((current) => (current === 0 ? maxIndex : current - 1));
  };

  const next = () => {
    setIndex((current) => (current === maxIndex ? 0 : current + 1));
  };

  return (
    <div className={`image-carousel ${variant === 'projects' ? 'projects-carousel' : 'details-carousel'}`}>
      <button
        type="button"
        className="carousel-arrow left"
        onClick={previous}
        aria-label="Imagen anterior"
        disabled={items.length <= 1}
      >
        ‹
      </button>

      <div className="carousel-viewport">
        <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {items.map((item) => (
            <figure className="carousel-slide" key={`${item.src}-${item.caption || ''}`}>
              <img src={item.src} alt={item.alt} />
              {item.caption ? <figcaption className="carousel-caption">{item.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="carousel-arrow right"
        onClick={next}
        aria-label="Siguiente imagen"
        disabled={items.length <= 1}
      >
        ›
      </button>
    </div>
  );
}

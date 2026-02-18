'use client';

import { useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type ResourceCard = {
  title: string;
  url: string | null;
};

type WeeklyReportItem = {
  id: string;
  imageUrl: string;
  description: string;
  createdAt: string | null;
};

type ClientProjectDashboardProps = {
  clientName: string;
  projectStatus: string;
  cards: ResourceCard[];
  reports: WeeklyReportItem[];
};

type ReportPhoto = {
  id: string;
  imageUrl: string;
};

type WeeklyReportGroup = {
  id: string;
  dateKey: string;
  description: string;
  photos: ReportPhoto[];
};

function CardIcon({ title }: { title: string }) {
  const normalized = title.toLowerCase();

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.5 7.5a2 2 0 0 1 2-2H10l1.6 1.8c.25.28.61.45.99.45H18.5a2 2 0 0 1 2 2v6.75a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5V7.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {normalized.includes('planos') ? (
        <path d="M8 12.2h8M8 15.2h6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      ) : null}
      {normalized.includes('renders') ? (
        <path d="M8 15l2-2 1.6 1.3 2.1-2.5 1.3 1.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
      ) : null}
      {normalized.includes('pagos') ? (
        <path d="M8 13h8M11.8 11.4v3.4" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      ) : null}
      {normalized.includes('contratos') ? (
        <path d="M8 12.2h8M8 15.2h5.8" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

export function ClientProjectDashboard({
  clientName,
  projectStatus,
  cards,
  reports
}: ClientProjectDashboardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const groupedReports = useMemo<WeeklyReportGroup[]>(() => {
    const groups = new Map<string, WeeklyReportGroup>();

    reports.forEach((report) => {
      const dateKey = (report.createdAt || '').slice(0, 10) || 'sin-fecha';
      const description = report.description.trim();
      const groupKey = `${dateKey}::${description || 'sin-descripcion'}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          dateKey,
          description,
          photos: []
        });
      }

      groups.get(groupKey)?.photos.push({
        id: report.id,
        imageUrl: report.imageUrl
      });
    });

    return Array.from(groups.values());
  }, [reports]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groupedReports[0]?.id ?? null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(groupedReports[0]?.photos[0]?.id ?? null);

  const selectedGroup = useMemo(() => {
    if (!groupedReports.length) {
      return null;
    }

    if (!selectedGroupId) {
      return groupedReports[0];
    }

    return groupedReports.find((report) => report.id === selectedGroupId) ?? groupedReports[0];
  }, [groupedReports, selectedGroupId]);

  const featuredPhoto = useMemo(() => {
    if (!selectedGroup || selectedGroup.photos.length === 0) {
      return null;
    }

    if (!selectedPhotoId) {
      return selectedGroup.photos[0];
    }

    return selectedGroup.photos.find((photo) => photo.id === selectedPhotoId) ?? selectedGroup.photos[0];
  }, [selectedGroup, selectedPhotoId]);

  const formatReportDate = (dateKey: string) => {
    if (!dateKey || dateKey === 'sin-fecha') {
      return 'FECHA NO DISPONIBLE';
    }

    const parsed = new Date(dateKey);
    if (Number.isNaN(parsed.getTime())) {
      return 'FECHA NO DISPONIBLE';
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(parsed).toUpperCase();
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <main className="client-shell">
      <section className="client-section">
        <header className="client-welcome">
          <div className="client-welcome-top">
            <p className="client-eyebrow">Panel de Cliente</p>
            <button type="button" className="client-logout-btn" onClick={onSignOut}>
              Cerrar sesión
            </button>
          </div>
          <h1>Bienvenido, {clientName}</h1>
          <p className="client-status">Estado del proyecto: {projectStatus}</p>
        </header>

        <section className="client-card-grid" aria-label="Recursos del proyecto">
          {cards.map((card) => (
            <article className="client-card" key={card.title}>
              {card.url ? (
                <a href={card.url} target="_blank" rel="noreferrer noopener">
                  <span className="client-card-icon">
                    <CardIcon title={card.title} />
                  </span>
                  {card.title}
                </a>
              ) : (
                <span className="client-card-disabled">
                  <span className="client-card-icon">
                    <CardIcon title={card.title} />
                  </span>
                  {card.title}
                </span>
              )}
            </article>
          ))}
        </section>

        <section className="client-gallery">
          <h2>Bitácora de avance</h2>

          {!selectedGroup || !featuredPhoto ? (
            <article className="client-placeholder">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16v10H4z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 14l2.7-2.7 2.6 2 3.2-3.7L18 12" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <p>Estamos preparando el registro fotografico de esta semana</p>
            </article>
          ) : (
            <article className="client-report-card">
              <header className="client-report-header">
                <p className="client-report-date">{formatReportDate(selectedGroup.dateKey)}</p>
                <p className="client-report-title">Reporte Semanal de Avance</p>
              </header>

              <div className="client-featured">
                <img key={featuredPhoto.id} src={featuredPhoto.imageUrl} alt="Avance destacado del proyecto" className="client-featured-image" />
              </div>

              <p className="client-report-description">
                {selectedGroup.description || 'Sin descripción para este reporte.'}
              </p>

              {selectedGroup.photos.length > 1 ? (
                <div className="client-thumbs" aria-label="Galería de avances">
                  {selectedGroup.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      className={`client-thumb ${featuredPhoto.id === photo.id ? 'active' : ''}`}
                      onClick={() => setSelectedPhotoId(photo.id)}
                      aria-label="Ver imagen de avance"
                    >
                      <img src={photo.imageUrl} alt="Miniatura de avance semanal" />
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          )}

          {groupedReports.length > 1 ? (
            <div className="client-report-nav" aria-label="Seleccionar reporte semanal">
              {groupedReports.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`client-report-pill ${selectedGroup?.id === group.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setSelectedPhotoId(group.photos[0]?.id || null);
                  }}
                >
                  {formatReportDate(group.dateKey)}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

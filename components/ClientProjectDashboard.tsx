'use client';

import { useMemo, useState } from 'react';

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

export function ClientProjectDashboard({
  clientName,
  projectStatus,
  cards,
  reports
}: ClientProjectDashboardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);

  const featured = useMemo(() => {
    if (!reports.length) {
      return null;
    }

    if (!selectedId) {
      return reports[0];
    }

    return reports.find((report) => report.id === selectedId) ?? reports[0];
  }, [reports, selectedId]);

  return (
    <main className="client-shell">
      <section className="client-section">
        <header className="client-welcome">
          <img src="/MaiaSedacaLogo.png" alt="Maia Sedaca Logo" className="client-logo" />
          <h1>Bienvenido a su proyecto, {clientName}</h1>
          <p className="client-status">Estado: {projectStatus}</p>
        </header>

        <section className="client-card-grid" aria-label="Recursos del proyecto">
          {cards.map((card) => (
            <article className="client-card" key={card.title}>
              {card.url ? (
                <a href={card.url} target="_blank" rel="noreferrer noopener">
                  {card.title}
                </a>
              ) : (
                <span className="client-card-disabled">{card.title}</span>
              )}
            </article>
          ))}
        </section>

        <section className="client-gallery">
          <h2>Bitácora de avance</h2>

          {!featured ? (
            <p>No hay reportes semanales cargados para este cliente.</p>
          ) : (
            <>
              <article className="client-featured">
                <img src={featured.imageUrl} alt="Avance destacado del proyecto" />
                <div>
                  <p>{featured.description || 'Sin descripción para este reporte.'}</p>
                </div>
              </article>

              <div className="client-thumbs">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    className={`client-thumb ${featured.id === report.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(report.id)}
                    aria-label="Ver imagen de avance"
                  >
                    <img src={report.imageUrl} alt="Miniatura de avance semanal" />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type ClientSummary = {
  user_id: string;
  client_name: string;
  project_status: string | null;
};

type ClientLink = {
  category?: string | null;
  url?: string | null;
};

type LandingSection = {
  section_key?: string | null;
  sort_order?: number | null;
  title?: string | null;
  image_url?: string | null;
};

type ApiError = {
  error?: string;
};

const LINK_CATEGORIES = ['DOCUMENTACION', 'PLANOS', 'RENDERS', 'CONTRATOS', 'PAGOS'] as const;
type LinkCategory = (typeof LINK_CATEGORIES)[number];
type LinkMap = Record<LinkCategory, string>;

const emptyLinks = (): LinkMap => ({
  DOCUMENTACION: '',
  PLANOS: '',
  RENDERS: '',
  CONTRATOS: '',
  PAGOS: ''
});

const LANDING_SLOTS = [
  { sectionKey: 'hero', sortOrder: 1, label: 'Hero Principal' },
  { sectionKey: 'obras', sortOrder: 1, label: 'Obras 1' },
  { sectionKey: 'obras', sortOrder: 2, label: 'Obras 2' },
  { sectionKey: 'obras', sortOrder: 3, label: 'Obras 3' },
  { sectionKey: 'obras', sortOrder: 4, label: 'Obras 4' },
  { sectionKey: 'detalles', sortOrder: 1, label: 'Detalles 1' },
  { sectionKey: 'detalles', sortOrder: 2, label: 'Detalles 2' },
  { sectionKey: 'detalles', sortOrder: 3, label: 'Detalles 3' },
  { sectionKey: 'detalles', sortOrder: 4, label: 'Detalles 4' }
] as const;

type DashboardView = 'clients' | 'project' | 'reports' | 'cms';

export function AdminDashboardPanel() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [view, setView] = useState<DashboardView>('clients');

  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [creatingClient, setCreatingClient] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState('');

  const [projectLoading, setProjectLoading] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectStatus, setProjectStatus] = useState('');
  const [projectLinks, setProjectLinks] = useState<LinkMap>(emptyLinks);

  const [reportUploading, setReportUploading] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);

  const [landingLoading, setLandingLoading] = useState(true);
  const [landingSaving, setLandingSaving] = useState(false);
  const [landingRows, setLandingRows] = useState<LandingSection[]>([]);
  const [cmsSectionKey, setCmsSectionKey] = useState('hero');
  const [cmsSortOrder, setCmsSortOrder] = useState(1);
  const [cmsTitle, setCmsTitle] = useState('');
  const [cmsFile, setCmsFile] = useState<File | null>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.user_id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const clearAlerts = () => {
    setGlobalMessage(null);
    setGlobalError(null);
  };

  const loadClients = async () => {
    setLoadingClients(true);
    const response = await fetch('/api/admin/clients');
    const payload = (await response.json()) as { clients?: ClientSummary[] } & ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo cargar la lista de clientes.');
      setLoadingClients(false);
      return;
    }

    const list = payload.clients || [];
    setClients(list);

    if (!selectedClientId && list.length > 0) {
      setSelectedClientId(list[0].user_id);
    }

    if (selectedClientId && !list.some((client) => client.user_id === selectedClientId)) {
      setSelectedClientId(list[0]?.user_id || '');
    }

    setLoadingClients(false);
  };

  const loadSelectedClientProject = async (userId: string) => {
    if (!userId) {
      setProjectStatus('');
      setProjectLinks(emptyLinks());
      return;
    }

    setProjectLoading(true);
    const response = await fetch(`/api/admin/clients/${userId}`);
    const payload = (await response.json()) as {
      profile?: { project_status?: string | null };
      links?: ClientLink[];
    } & ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo cargar el panel del proyecto.');
      setProjectLoading(false);
      return;
    }

    const links = emptyLinks();
    (payload.links || []).forEach((link) => {
      const key = (link.category || '').toUpperCase() as LinkCategory;
      if (Object.hasOwn(links, key)) {
        links[key] = (link.url || '').trim();
      }
    });

    setProjectStatus(payload.profile?.project_status?.trim() || '');
    setProjectLinks(links);
    setProjectLoading(false);
  };

  const loadLandingSections = async () => {
    setLandingLoading(true);
    const response = await fetch('/api/admin/landing-sections');
    const payload = (await response.json()) as { sections?: LandingSection[] } & ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo cargar landing_sections.');
      setLandingLoading(false);
      return;
    }

    setLandingRows(payload.sections || []);
    setLandingLoading(false);
  };

  useEffect(() => {
    void loadClients();
    void loadLandingSections();
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }

    void loadSelectedClientProject(selectedClientId);
  }, [selectedClientId]);

  const onCreateClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAlerts();
    setCreatingClient(true);

    const response = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        clientName: newClientName,
        projectStatus: newProjectStatus,
        links: {
          DOCUMENTACION: 'https://drive.google.com/',
          PLANOS: 'https://drive.google.com/',
          RENDERS: 'https://drive.google.com/',
          CONTRATOS: 'https://drive.google.com/',
          PAGOS: 'https://drive.google.com/',
          FOTOS: 'https://drive.google.com/'
        }
      })
    });

    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo crear el cliente.');
      setCreatingClient(false);
      return;
    }

    setGlobalMessage('Cliente creado correctamente.');
    setEmail('');
    setPassword('');
    setNewClientName('');
    setNewProjectStatus('');
    await loadClients();
    setCreatingClient(false);
  };

  const onDeleteClient = async (userId: string, clientName: string) => {
    const confirmDelete = window.confirm(`Se eliminará ${clientName} y todo su acceso. ¿Continuar?`);
    if (!confirmDelete) {
      return;
    }

    clearAlerts();
    const response = await fetch('/api/admin/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    const payload = (await response.json()) as ApiError;
    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo eliminar el cliente.');
      return;
    }

    setGlobalMessage(`Cliente ${clientName} eliminado.`);
    await loadClients();
  };

  const onSaveProjectControl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClientId) {
      setGlobalError('Seleccioná un cliente primero.');
      return;
    }

    clearAlerts();
    setProjectSaving(true);

    const response = await fetch(`/api/admin/clients/${selectedClientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectStatus,
        links: projectLinks
      })
    });

    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo actualizar el proyecto.');
      setProjectSaving(false);
      return;
    }

    setGlobalMessage('Datos del proyecto actualizados.');
    await loadClients();
    await loadSelectedClientProject(selectedClientId);
    setProjectSaving(false);
  };

  const onUploadReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedClientId) {
      setGlobalError('Seleccioná un cliente para subir el reporte.');
      return;
    }

    if (!reportFile) {
      setGlobalError('Seleccioná una imagen JPG o PNG.');
      return;
    }

    clearAlerts();
    setReportUploading(true);

    const body = new FormData();
    body.set('userId', selectedClientId);
    body.set('description', reportDescription);
    body.set('file', reportFile);

    const response = await fetch('/api/admin/reports', {
      method: 'POST',
      body
    });

    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo cargar el reporte.');
      setReportUploading(false);
      return;
    }

    setGlobalMessage('Reporte semanal cargado correctamente.');
    setReportDescription('');
    setReportFile(null);
    setReportUploading(false);
  };

  const onUploadLandingImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!cmsFile) {
      setGlobalError('Seleccioná una imagen para actualizar la landing.');
      return;
    }

    clearAlerts();
    setLandingSaving(true);

    const body = new FormData();
    body.set('sectionKey', cmsSectionKey);
    body.set('sortOrder', String(cmsSortOrder));
    body.set('title', cmsTitle);
    body.set('file', cmsFile);

    const response = await fetch('/api/admin/landing-sections', {
      method: 'POST',
      body
    });

    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo actualizar landing_sections.');
      setLandingSaving(false);
      return;
    }

    setGlobalMessage('Landing actualizada correctamente.');
    setCmsTitle('');
    setCmsFile(null);
    await loadLandingSections();
    setLandingSaving(false);
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const renderClientManagement = () => (
    <section className="admin-main-card">
      <h2>Gestión de Clientes</h2>
      <div className="admin-main-grid">
        <article className="admin-card">
          <h3>Alta de Cliente</h3>
          <form className="admin-form" onSubmit={onCreateClient}>
            <input className="admin-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              className="admin-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              className="admin-input"
              type="text"
              placeholder="Nombre del cliente"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              required
            />
            <input
              className="admin-input"
              type="text"
              placeholder="Estado inicial del proyecto"
              value={newProjectStatus}
              onChange={(e) => setNewProjectStatus(e.target.value)}
              required
            />
            <button className="admin-submit-btn" type="submit" disabled={creatingClient}>
              {creatingClient ? 'Creando...' : 'Crear Cliente'}
            </button>
          </form>
        </article>

        <article className="admin-card">
          <h3>Lista de Clientes</h3>
          {loadingClients ? <p>Cargando clientes...</p> : null}
          {!loadingClients && clients.length === 0 ? <p>No hay clientes cargados.</p> : null}
          {!loadingClients && clients.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.user_id}>
                    <td>{client.client_name}</td>
                    <td>{client.project_status || 'Sin estado'}</td>
                    <td>
                      <button type="button" className="admin-delete-btn" onClick={() => onDeleteClient(client.user_id, client.client_name)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </article>
      </div>
    </section>
  );

  const renderProjectControl = () => (
    <section className="admin-main-card">
      <h2>Panel de Control del Proyecto</h2>
      <article className="admin-card">
        <div className="admin-row">
          <label>Cliente seleccionado</label>
          <select
            className="admin-input"
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
          >
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.user_id} value={client.user_id}>
                {client.client_name}
              </option>
            ))}
          </select>
        </div>

        {projectLoading ? <p>Cargando datos...</p> : null}

        {!projectLoading && selectedClient ? (
          <form className="admin-form" onSubmit={onSaveProjectControl}>
            <input
              className="admin-input"
              type="text"
              placeholder="Estado del proyecto"
              value={projectStatus}
              onChange={(event) => setProjectStatus(event.target.value)}
              required
            />

            {LINK_CATEGORIES.map((category) => (
              <input
                key={category}
                className="admin-input"
                type="url"
                placeholder={`Link ${category}`}
                value={projectLinks[category]}
                onChange={(event) =>
                  setProjectLinks((current) => ({
                    ...current,
                    [category]: event.target.value
                  }))
                }
                required
              />
            ))}

            <button type="submit" className="admin-submit-btn" disabled={projectSaving}>
              {projectSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        ) : null}
      </article>
    </section>
  );

  const renderReports = () => (
    <section className="admin-main-card">
      <h2>Galería y Bitácora (Upload)</h2>
      <article className="admin-card">
        <form className="admin-form" onSubmit={onUploadReport}>
          <select className="admin-input" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.user_id} value={client.user_id}>
                {client.client_name}
              </option>
            ))}
          </select>
          <textarea
            className="admin-input"
            placeholder="Descripción del avance semanal"
            value={reportDescription}
            onChange={(event) => setReportDescription(event.target.value)}
            rows={4}
            required
          />
          <input
            className="admin-input"
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => setReportFile(event.target.files?.[0] || null)}
            required
          />
          <button className="admin-submit-btn" type="submit" disabled={reportUploading}>
            {reportUploading ? 'Subiendo...' : 'Subir Reporte'}
          </button>
        </form>
      </article>
    </section>
  );

  const renderCms = () => (
    <section className="admin-main-card">
      <h2>Editor de Landing (CMS)</h2>
      <div className="admin-main-grid">
        <article className="admin-card">
          <h3>Reemplazar imagen</h3>
          <form className="admin-form" onSubmit={onUploadLandingImage}>
            <select className="admin-input" value={`${cmsSectionKey}:${cmsSortOrder}`} onChange={(event) => {
              const [key, order] = event.target.value.split(':');
              setCmsSectionKey(key);
              setCmsSortOrder(Number(order));
            }}>
              {LANDING_SLOTS.map((slot) => (
                <option key={`${slot.sectionKey}-${slot.sortOrder}`} value={`${slot.sectionKey}:${slot.sortOrder}`}>
                  {slot.label}
                </option>
              ))}
            </select>
            <input
              className="admin-input"
              type="text"
              placeholder="Título opcional"
              value={cmsTitle}
              onChange={(event) => setCmsTitle(event.target.value)}
            />
            <input
              className="admin-input"
              type="file"
              accept="image/jpeg,image/png"
              onChange={(event) => setCmsFile(event.target.files?.[0] || null)}
              required
            />
            <button className="admin-submit-btn" type="submit" disabled={landingSaving}>
              {landingSaving ? 'Actualizando...' : 'Actualizar Landing'}
            </button>
          </form>
        </article>

        <article className="admin-card">
          <h3>Contenido actual</h3>
          {landingLoading ? <p>Cargando secciones...</p> : null}
          {!landingLoading && landingRows.length === 0 ? <p>No hay registros en landing_sections.</p> : null}
          {!landingLoading && landingRows.length > 0 ? (
            <div className="admin-landing-list">
              {landingRows.map((row, index) => (
                <div key={`${row.section_key}-${row.sort_order}-${index}`} className="admin-landing-item">
                  <div>
                    <strong>{row.section_key}</strong> #{row.sort_order}
                    <p>{row.title || 'Sin título'}</p>
                  </div>
                  {row.image_url ? <img src={row.image_url} alt="Preview landing" /> : null}
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <h1>Admin Panel</h1>
        <button type="button" className="dashboard-logout-btn" onClick={onSignOut}>
          Cerrar sesión
        </button>
        <button type="button" className={`dashboard-nav-btn ${view === 'clients' ? 'active' : ''}`} onClick={() => setView('clients')}>
          Gestión de Clientes
        </button>
        <button type="button" className={`dashboard-nav-btn ${view === 'project' ? 'active' : ''}`} onClick={() => setView('project')}>
          Datos del Proyecto
        </button>
        <button type="button" className={`dashboard-nav-btn ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')}>
          Bitácora y Fotos
        </button>
        <button type="button" className={`dashboard-nav-btn ${view === 'cms' ? 'active' : ''}`} onClick={() => setView('cms')}>
          Editor Landing
        </button>
      </aside>

      <section className="dashboard-content">
        {globalMessage ? <p className="admin-message success">{globalMessage}</p> : null}
        {globalError ? <p className="admin-message error">{globalError}</p> : null}

        {view === 'clients' ? renderClientManagement() : null}
        {view === 'project' ? renderProjectControl() : null}
        {view === 'reports' ? renderReports() : null}
        {view === 'cms' ? renderCms() : null}
      </section>
    </main>
  );
}

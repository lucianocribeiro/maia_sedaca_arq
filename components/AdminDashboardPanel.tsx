'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type ClientSummary = {
  id: string | number;
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
type ReportBatchPayload = ApiError & {
  reportsCreated?: number;
};
type WeeklyReportInsert = {
  client_id: string;
  photo_url: string;
  description: string;
  report_date: string;
};
type AdminWeeklyReportRow = {
  id?: string | null;
  client_id?: string | null;
  photo_url?: string | null;
  description?: string | null;
  report_date?: string | null;
  created_at?: string | null;
};
type AdminWeeklyStatusGroup = {
  id: string;
  clientId: string;
  reportDate: string;
  description: string;
  photos: Array<{ id: string; photoUrl: string }>;
};

const LINK_CATEGORIES = ['DOCUMENTACION', 'PLANOS', 'RENDERS', 'CONTRATOS', 'PAGOS'] as const;
const REPORTS_BUCKET = 'proyectos';
const DELETE_CONFIRM_MESSAGE =
  '¿Estás seguro de que deseas eliminar este contenido? Esta acción liberará espacio y no se puede deshacer';
type LinkCategory = (typeof LINK_CATEGORIES)[number];
type LinkMap = Record<LinkCategory, string>;

const emptyLinks = (): LinkMap => ({
  DOCUMENTACION: '',
  PLANOS: '',
  RENDERS: '',
  CONTRATOS: '',
  PAGOS: ''
});

const LANDING_MIN_ITEMS = 4;
const LANDING_MAX_ITEMS = 20;

type LandingSlot = {
  sectionKey: 'hero' | 'obras' | 'detalles';
  sortOrder: number;
  label: string;
};

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
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [reportInputKey, setReportInputKey] = useState(0);
  const [reportUploadCurrent, setReportUploadCurrent] = useState(0);
  const [reportUploadTotal, setReportUploadTotal] = useState(0);
  const [reportRows, setReportRows] = useState<AdminWeeklyReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMutatingId, setReportMutatingId] = useState<string | null>(null);

  const [landingLoading, setLandingLoading] = useState(true);
  const [landingSaving, setLandingSaving] = useState(false);
  const [landingRows, setLandingRows] = useState<LandingSection[]>([]);
  const [obrasSlots, setObrasSlots] = useState(LANDING_MIN_ITEMS);
  const [detallesSlots, setDetallesSlots] = useState(LANDING_MIN_ITEMS);
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

  const formatReportDate = (dateKey: string) => {
    const normalized = dateKey.trim();
    if (!normalized) {
      return 'Fecha no disponible';
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return normalized;
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(parsed);
  };

  const loadClients = async () => {
    setLoadingClients(true);
    const response = await fetch('/api/admin/clients');
    const payload = (await response.json()) as { clients?: Array<Partial<ClientSummary>> } & ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo cargar la lista de clientes.');
      setLoadingClients(false);
      return;
    }

    const list = (payload.clients || [])
      .filter((client): client is Partial<ClientSummary> & { id: string | number; user_id: string; client_name: string } =>
        client.id !== undefined && client.id !== null && Boolean(client.user_id) && Boolean(client.client_name)
      )
      .map((client) => ({
        id: client.id,
        user_id: String(client.user_id),
        client_name: String(client.client_name),
        project_status: client.project_status || null
      }));
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

  const loadSelectedClientReports = async (userId: string) => {
    if (!userId) {
      setReportRows([]);
      return;
    }

    const selectedReportClient = clients.find((client) => client.user_id === userId) || null;
    const reportClientId = selectedReportClient ? String(selectedReportClient.id) : '';
    if (!reportClientId) {
      setReportRows([]);
      return;
    }

    setReportLoading(true);
    const response = await fetch(`/api/admin/reports?clientId=${encodeURIComponent(reportClientId)}`);
    const payload = (await response.json()) as { reports?: AdminWeeklyReportRow[] } & ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo cargar la bitácora semanal.');
      setReportLoading(false);
      return;
    }

    setReportRows(payload.reports || []);
    setReportLoading(false);
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

  useEffect(() => {
    if (!selectedClientId) {
      setReportRows([]);
      return;
    }

    const selectedReportClient = clients.find((client) => client.user_id === selectedClientId) || null;
    const reportClientId = selectedReportClient ? String(selectedReportClient.id) : '';
    if (!reportClientId) {
      setReportRows([]);
      return;
    }

    const loadReports = async () => {
      setReportLoading(true);
      const response = await fetch(`/api/admin/reports?clientId=${encodeURIComponent(reportClientId)}`);
      const payload = (await response.json()) as { reports?: AdminWeeklyReportRow[] } & ApiError;

      if (!response.ok) {
        setGlobalError(payload.error || 'No se pudo cargar la bitácora semanal.');
        setReportLoading(false);
        return;
      }

      setReportRows(payload.reports || []);
      setReportLoading(false);
    };

    void loadReports();
  }, [selectedClientId, clients]);

  useEffect(() => {
    const maxForSection = (sectionKey: 'obras' | 'detalles') =>
      landingRows.reduce((max, row) => {
        if ((row.section_key || '').toLowerCase() !== sectionKey) {
          return max;
        }
        const sortOrder = Number(row.sort_order || 0);
        return Number.isNaN(sortOrder) ? max : Math.max(max, sortOrder);
      }, 0);

    const nextObras = Math.min(LANDING_MAX_ITEMS, Math.max(LANDING_MIN_ITEMS, maxForSection('obras')));
    const nextDetalles = Math.min(LANDING_MAX_ITEMS, Math.max(LANDING_MIN_ITEMS, maxForSection('detalles')));

    setObrasSlots((current) => Math.max(current, nextObras));
    setDetallesSlots((current) => Math.max(current, nextDetalles));
  }, [landingRows]);

  const landingSlots = useMemo<LandingSlot[]>(() => {
    const slots: LandingSlot[] = [{ sectionKey: 'hero', sortOrder: 1, label: 'Hero Principal' }];

    for (let index = 1; index <= obrasSlots; index += 1) {
      slots.push({
        sectionKey: 'obras',
        sortOrder: index,
        label: `Obras ${index}`
      });
    }

    for (let index = 1; index <= detallesSlots; index += 1) {
      slots.push({
        sectionKey: 'detalles',
        sortOrder: index,
        label: `Detalles ${index}`
      });
    }

    return slots;
  }, [obrasSlots, detallesSlots]);

  const groupedWeeklyStatuses = useMemo<AdminWeeklyStatusGroup[]>(() => {
    const grouped = new Map<string, AdminWeeklyStatusGroup>();

    reportRows.forEach((row) => {
      const reportId = String(row.id || '').trim();
      const clientId = String(row.client_id || '').trim();
      const reportDate = String(row.report_date || '').trim();
      const description = String(row.description || '').trim();
      const photoUrl = String(row.photo_url || '').trim();

      if (!reportId || !clientId || !photoUrl) {
        return;
      }

      const statusKey = `${clientId}::${reportDate || 'sin-fecha'}::${description || 'sin-descripcion'}`;
      if (!grouped.has(statusKey)) {
        grouped.set(statusKey, {
          id: statusKey,
          clientId,
          reportDate,
          description,
          photos: []
        });
      }

      grouped.get(statusKey)?.photos.push({
        id: reportId,
        photoUrl
      });
    });

    return Array.from(grouped.values());
  }, [reportRows]);

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
    const confirmDelete = window.confirm(DELETE_CONFIRM_MESSAGE);
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

    if (reportFiles.length === 0) {
      setGlobalError('Seleccioná al menos una imagen JPG, PNG o WEBP.');
      return;
    }

    clearAlerts();
    setReportUploading(true);
    setReportUploadCurrent(0);
    setReportUploadTotal(reportFiles.length);

    const selectedReportClient = clients.find((client) => client.user_id === selectedClientId) || null;
    const reportClientId = selectedReportClient ? String(selectedReportClient.id) : '';
    if (!reportClientId) {
      setGlobalError('No se pudo resolver el client_id del cliente seleccionado.');
      setReportUploading(false);
      return;
    }

    const uploadedUrls: string[] = [];
    for (const file of reportFiles) {
      const extension = file.name.toLowerCase().split('.').pop() || 'jpg';
      const filePath = `weekly-reports/${selectedClientId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(REPORTS_BUCKET).upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

      if (uploadError) {
        setGlobalError(uploadError.message || 'No se pudo subir la imagen al storage.');
        setReportUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from(REPORTS_BUCKET).getPublicUrl(filePath);
      uploadedUrls.push(urlData.publicUrl);
      setReportUploadCurrent(uploadedUrls.length);
    }

    const response = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reports: uploadedUrls.map(
          (photoUrl): WeeklyReportInsert => ({
            client_id: reportClientId,
            photo_url: photoUrl,
            description: reportDescription,
            report_date: new Date().toISOString().slice(0, 10)
          })
        )
      })
    });

    const payload = (await response.json()) as ReportBatchPayload;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo guardar el reporte semanal.');
      setReportUploading(false);
      return;
    }

    const uploadedCount = payload.reportsCreated || uploadedUrls.length;
    setGlobalMessage(`Reporte semanal cargado correctamente (${uploadedCount} imagen${uploadedCount === 1 ? '' : 'es'}).`);
    setReportDescription('');
    setReportFiles([]);
    setReportInputKey((current) => current + 1);
    setReportUploading(false);
    setReportUploadCurrent(0);
    setReportUploadTotal(0);
    await loadSelectedClientReports(selectedClientId);
  };

  const onSaveWeeklyStatus = async (event: FormEvent<HTMLFormElement>, group: AdminWeeklyStatusGroup) => {
    event.preventDefault();
    clearAlerts();

    const formData = new FormData(event.currentTarget);
    const nextDescription = String(formData.get('description') || '').trim();
    const nextReportDate = String(formData.get('reportDate') || '').trim();
    if (!nextDescription || !nextReportDate) {
      setGlobalError('Completá fecha y descripción para guardar cambios.');
      return;
    }

    setReportMutatingId(`status:${group.id}`);
    const response = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_weekly_status',
        clientId: group.clientId,
        fromDescription: group.description,
        fromReportDate: group.reportDate,
        nextDescription,
        nextReportDate
      })
    });
    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo editar el estado semanal.');
      setReportMutatingId(null);
      return;
    }

    setGlobalMessage('Estado semanal actualizado.');
    await loadSelectedClientReports(selectedClientId);
    setReportMutatingId(null);
  };

  const onDeleteWeeklyStatus = async (group: AdminWeeklyStatusGroup) => {
    const confirmDelete = window.confirm(DELETE_CONFIRM_MESSAGE);
    if (!confirmDelete) {
      return;
    }

    clearAlerts();
    setReportMutatingId(`status:${group.id}`);
    const response = await fetch('/api/admin/reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_weekly_status',
        clientId: group.clientId,
        reportDate: group.reportDate,
        description: group.description
      })
    });
    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo eliminar el estado semanal.');
      setReportMutatingId(null);
      return;
    }

    setGlobalMessage('Estado semanal eliminado.');
    await loadSelectedClientReports(selectedClientId);
    setReportMutatingId(null);
  };

  const onDeleteWeeklyPhoto = async (reportId: string) => {
    const confirmDelete = window.confirm(DELETE_CONFIRM_MESSAGE);
    if (!confirmDelete) {
      return;
    }

    clearAlerts();
    setReportMutatingId(`photo:${reportId}`);
    const response = await fetch('/api/admin/reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_report_photo',
        reportId
      })
    });
    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo eliminar la foto.');
      setReportMutatingId(null);
      return;
    }

    setGlobalMessage('Foto eliminada.');
    await loadSelectedClientReports(selectedClientId);
    setReportMutatingId(null);
  };

  const onReplaceWeeklyPhoto = async (event: FormEvent<HTMLFormElement>, reportId: string) => {
    event.preventDefault();
    clearAlerts();

    const formData = new FormData(event.currentTarget);
    const replacementFile = formData.get('replacementPhoto');
    if (!(replacementFile instanceof File)) {
      setGlobalError('Seleccioná una imagen para reemplazar la foto.');
      return;
    }
    if (!selectedClientId) {
      setGlobalError('Seleccioná un cliente.');
      return;
    }

    const body = new FormData();
    body.set('action', 'replace_report_photo');
    body.set('reportId', reportId);
    body.set('userId', selectedClientId);
    body.set('file', replacementFile);

    setReportMutatingId(`photo:${reportId}`);
    const response = await fetch('/api/admin/reports', {
      method: 'PATCH',
      body
    });
    const payload = (await response.json()) as ApiError;

    if (!response.ok) {
      setGlobalError(payload.error || 'No se pudo reemplazar la foto.');
      setReportMutatingId(null);
      return;
    }

    setGlobalMessage('Foto actualizada.');
    await loadSelectedClientReports(selectedClientId);
    setReportMutatingId(null);
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
      <h2>Galería y Bitácora (Upload + Editar)</h2>
      <div className="admin-main-grid">
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
              key={reportInputKey}
              className="admin-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => setReportFiles(Array.from(event.target.files || []))}
              required
            />
            <button className="admin-submit-btn" type="submit" disabled={reportUploading}>
              {reportUploading ? 'Subiendo...' : 'Subir Reporte'}
            </button>
            {reportUploading && reportUploadTotal > 0 ? (
              <p>
                Progreso: {reportUploadCurrent}/{reportUploadTotal} imágenes
              </p>
            ) : null}
          </form>
        </article>

        <article className="admin-card">
          <h3>Estados semanales actuales</h3>
          {reportLoading ? <p>Cargando estados semanales...</p> : null}
          {!reportLoading && !selectedClientId ? <p>Seleccioná un cliente para ver su bitácora.</p> : null}
          {!reportLoading && selectedClientId && groupedWeeklyStatuses.length === 0 ? <p>No hay estados semanales cargados.</p> : null}
          {!reportLoading && groupedWeeklyStatuses.length > 0 ? (
            <div className="admin-reports-list">
              {groupedWeeklyStatuses.map((group) => (
                <article key={group.id} className="admin-report-item">
                  <form className="admin-form" onSubmit={(event) => onSaveWeeklyStatus(event, group)}>
                    <div className="admin-report-row">
                      <label>Fecha</label>
                      <input className="admin-input" name="reportDate" type="date" defaultValue={group.reportDate} required />
                    </div>
                    <textarea
                      className="admin-input"
                      name="description"
                      defaultValue={group.description}
                      rows={3}
                      placeholder="Descripción semanal"
                      required
                    />
                    <p className="admin-report-meta">
                      {formatReportDate(group.reportDate)} · {group.photos.length} foto{group.photos.length === 1 ? '' : 's'}
                    </p>
                    <div className="admin-report-actions">
                      <button type="submit" className="admin-submit-btn" disabled={reportMutatingId === `status:${group.id}`}>
                        {reportMutatingId === `status:${group.id}` ? 'Guardando...' : 'Guardar estado'}
                      </button>
                      <button
                        type="button"
                        className="admin-delete-btn"
                        onClick={() => onDeleteWeeklyStatus(group)}
                        disabled={reportMutatingId === `status:${group.id}`}
                      >
                        Eliminar estado
                      </button>
                    </div>
                  </form>

                  <div className="admin-report-photo-grid">
                    {group.photos.map((photo) => (
                      <div key={photo.id} className="admin-report-photo-card">
                        <img src={photo.photoUrl} alt="Foto del reporte semanal" />
                        <form className="admin-form" onSubmit={(event) => onReplaceWeeklyPhoto(event, photo.id)}>
                          <input
                            className="admin-input"
                            type="file"
                            name="replacementPhoto"
                            accept="image/jpeg,image/png,image/webp"
                            required
                          />
                          <div className="admin-report-actions">
                            <button type="submit" className="admin-submit-btn" disabled={reportMutatingId === `photo:${photo.id}`}>
                              {reportMutatingId === `photo:${photo.id}` ? 'Actualizando...' : 'Cambiar foto'}
                            </button>
                            <button
                              type="button"
                              className="admin-delete-btn"
                              onClick={() => onDeleteWeeklyPhoto(photo.id)}
                              disabled={reportMutatingId === `photo:${photo.id}`}
                            >
                              Eliminar foto
                            </button>
                          </div>
                        </form>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );

  const renderCms = () => (
    <section className="admin-main-card">
      <h2>Editor de Landing (CMS)</h2>
      <div className="admin-main-grid">
        <article className="admin-card">
          <h3>Reemplazar imagen</h3>
          <form className="admin-form" onSubmit={onUploadLandingImage}>
            <div className="admin-row">
              <button
                type="button"
                className="admin-submit-btn"
                onClick={() => setObrasSlots((current) => Math.min(LANDING_MAX_ITEMS, current + 1))}
                disabled={obrasSlots >= LANDING_MAX_ITEMS}
              >
                Add Obras ({obrasSlots}/{LANDING_MAX_ITEMS})
              </button>
              <button
                type="button"
                className="admin-submit-btn"
                onClick={() => setDetallesSlots((current) => Math.min(LANDING_MAX_ITEMS, current + 1))}
                disabled={detallesSlots >= LANDING_MAX_ITEMS}
              >
                Add Detalles ({detallesSlots}/{LANDING_MAX_ITEMS})
              </button>
            </div>
            <select className="admin-input" value={`${cmsSectionKey}:${cmsSortOrder}`} onChange={(event) => {
              const [key, order] = event.target.value.split(':');
              setCmsSectionKey(key);
              setCmsSortOrder(Number(order));
            }}>
              {landingSlots.map((slot) => (
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

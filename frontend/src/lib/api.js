/**
 * AgencyPM v2 API client.
 *
 * Single source of truth for the backend contract. Every page imports from
 * here so renaming an endpoint touches one file.
 */
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
export const API_BASE = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API_BASE });

const get  = (url, params)  => http.get(url, { params }).then(r => r.data);
const post = (url, body)    => http.post(url, body).then(r => r.data);
const patch = (url, body)   => http.patch(url, body).then(r => r.data);
const del  = (url)          => http.delete(url).then(r => r.data);

// ---------- Agency ----------
export const Agencies = {
  list:   ()        => get('/agencies'),
  get:    (id)      => get(`/agencies/${id}`),
  create: (body)    => post('/agencies', body),
};

// ---------- Departments ----------
export const Departments = {
  list:   (agencyId) => get('/departments', { agencyId }),
  create: (body)     => post('/departments', body),
  update: (id, p)    => patch(`/departments/${id}`, p),
  delete: (id)       => del(`/departments/${id}`),
};

// ---------- Pods ----------
export const Pods = {
  list:   (agencyId, departmentId) => get('/pods', { agencyId, departmentId }),
  create: (body)                    => post('/pods', body),
  update: (id, p)                   => patch(`/pods/${id}`, p),
  delete: (id)                      => del(`/pods/${id}`),
};

// ---------- Users ----------
export const Users = {
  list:        (params)   => get('/users', params),
  get:         (id)       => get(`/users/${id}`),
  getByEmail:  (email)    => get(`/users/by-email/${encodeURIComponent(email)}`),
  create:      (body)     => post('/users', body),
  update:      (id, p)    => patch(`/users/${id}`, p),
  delete:      (id)       => del(`/users/${id}`),
};

// ---------- Clients ----------
export const Clients = {
  list:   (params)   => get('/clients', params),
  get:    (id)       => get(`/clients/${id}`),
  create: (body)     => post('/clients', body),
  update: (id, p)    => patch(`/clients/${id}`, p),
  delete: (id)       => del(`/clients/${id}`),
};

// ---------- Projects ----------
export const Projects = {
  list:        (params)            => get('/projects', params),
  get:         (id)                => get(`/projects/${id}`),
  create:      (body)              => post('/projects', body),
  update:      (id, p)             => patch(`/projects/${id}`, p),
  delete:      (id)                => del(`/projects/${id}`),
  updateStage: (id, idx, p)        => patch(`/projects/${id}/stages/${idx}`, p),
};

// ---------- Campaigns ----------
export const Campaigns = {
  listForProject: (projectId)  => get(`/projects/${projectId}/campaigns`),
  create:         (body)        => post('/campaigns', body),
  update:         (id, p)       => patch(`/campaigns/${id}`, p),
  delete:         (id)          => del(`/campaigns/${id}`),
};

// ---------- Deliverables ----------
export const Deliverables = {
  listForProject: (projectId, campaignId) =>
    get(`/projects/${projectId}/deliverables`, campaignId ? { campaignId } : undefined),
  create: (body)  => post('/deliverables', body),
  update: (id, p) => patch(`/deliverables/${id}`, p),
  delete: (id)    => del(`/deliverables/${id}`),
};

// ---------- Phases ----------
export const Phases = {
  listForProject: (projectId) => get(`/projects/${projectId}/phases`),
  create:         (body)       => post('/phases', body),
  update:         (id, p)      => patch(`/phases/${id}`, p),
  delete:         (id)         => del(`/phases/${id}`),
};

// ---------- Tasks ----------
export const Tasks = {
  list:        (params)    => get('/tasks', params),
  forProject:  (projectId) => get(`/tasks/project/${projectId}`),
  forUser:     (userId)    => get(`/tasks/user/${userId}`),
  get:         (id)        => get(`/tasks/${id}`),
  create:      (body)      => post('/tasks', body),
  update:      (id, p)     => patch(`/tasks/${id}`, p),
  delete:      (id)        => del(`/tasks/${id}`),
};

// ---------- Subtasks ----------
export const Subtasks = {
  listForTask: (taskId)   => get(`/tasks/${taskId}/subtasks`),
  create:      (body)     => post('/subtasks', body),
  update:      (id, p)    => patch(`/subtasks/${id}`, p),
  delete:      (id)       => del(`/subtasks/${id}`),
};

// ---------- Approvals ----------
export const Approvals = {
  list:           (params)     => get('/approvals', params),
  forProject:     (projectId)  => get(`/approvals/project/${projectId}`),
  create:         (body)       => post('/approvals', body),
  decide:         (id, body)   => patch(`/approvals/${id}`, body),
  cancel:         (id)         => del(`/approvals/${id}`),
  getByToken:     (token)      => get(`/public/approvals/${token}`),
  decideByToken:  (token, body) => post(`/public/approvals/${token}/decide`, body),
};

// ---------- Holidays ----------
export const Holidays = {
  list:   (agencyId) => get('/holidays', { agencyId }),
  create: (body)     => post('/holidays', body),
  update: (id, p)    => patch(`/holidays/${id}`, p),
  delete: (id)       => del(`/holidays/${id}`),
  seed:   (agencyId) => post(`/holidays/seed${agencyId ? `?agencyId=${agencyId}` : ''}`),
};

// ---------- Admin ----------
export const Admin = {
  seed: (wipe = true) => post(`/admin/seed?wipe=${wipe}`),
  wipe: ()            => post('/admin/wipe'),
};

// ---------- Convenience hooks (no React deps; just shapes) ----------

/** Fan-out fetcher: returns a `{users, byId, byEmail}` lookup table for an agency. */
export async function loadUserDirectory(agencyId) {
  const users = await Users.list({ agencyId });
  const byId    = Object.fromEntries(users.map(u => [u.id, u]));
  const byEmail = Object.fromEntries(users.filter(u => u.email).map(u => [u.email, u]));
  return { users, byId, byEmail };
}

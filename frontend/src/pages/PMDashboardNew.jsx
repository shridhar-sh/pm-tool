import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Calendar, ChevronRight, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Agencies, Projects, Clients as ClientsApi, Pods, Users as UsersApi,
} from '@/lib/api';

const STAGE_DEPT_COLORS = {
  strategy:        'bg-violet-500',
  pre_production:  'bg-sky-500',
  production:      'bg-amber-500',
  post_production: 'bg-emerald-500',
};

export default function PMDashboardNew({ user }) {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [pods, setPods] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  function emptyDraft() {
    return {
      name: '', clientId: '', sow: '',
      projectStartDate: '', projectEndDate: '',
      podId: '', assignedAMUserId: '', assignedLPUserId: '', assignedPMUserId: '',
      projectType: 'fashion', budgetINR: 0,
    };
  }

  useEffect(() => { (async () => { await loadAll(); })(); }, []);
  useEffect(() => {
    if (routeId) setSelectedId(routeId);
    else if (projects.length > 0 && !selectedId) setSelectedId(projects[0].id);
  }, [routeId, projects]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    try {
      const ags = await Agencies.list();
      const aid = ags[0]?.id;
      setAgencyId(aid);
      const [ps, cs, pds, us] = await Promise.all([
        Projects.list(aid ? { agencyId: aid } : undefined),
        ClientsApi.list(aid ? { agencyId: aid } : undefined),
        Pods.list(aid),
        UsersApi.list({ agencyId: aid }),
      ]);
      setProjects(ps);
      setClients(cs);
      setPods(pds);
      setUsers(us);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    const byClient = Object.fromEntries(clients.map(c => [c.id, c]));
    return projects.filter(p => {
      const hay = `${p.name} ${byClient[p.clientId]?.name || ''} ${p.sow || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, clients, search]);

  const selected = projects.find(p => p.id === selectedId);
  const usersByRole = useMemo(() => {
    const m = { project_manager: [], account_manager: [], line_producer: [] };
    for (const u of users) {
      if (m[u.role]) m[u.role].push(u);
    }
    return m;
  }, [users]);

  async function createProject() {
    if (!draft.name || !draft.clientId || !draft.projectStartDate || !draft.projectEndDate) {
      return toast.error('Name, client, and dates are required');
    }
    try {
      const created = await Projects.create({
        agencyId,
        clientId: draft.clientId,
        name: draft.name,
        sow: draft.sow || '',
        projectStartDate: draft.projectStartDate,
        projectEndDate: draft.projectEndDate,
        statusCategory: 'active',
        assignedPMUserId: draft.assignedPMUserId || null,
        assignedAMUserId: draft.assignedAMUserId || null,
        assignedLPUserId: draft.assignedLPUserId || null,
        podId: draft.podId || null,
        projectType: draft.projectType,
        budgetINR: Number(draft.budgetINR) || 0,
        createdBy: user?.name,
      });
      setProjects(prev => [created, ...prev]);
      setSelectedId(created.id);
      setDialogOpen(false);
      setDraft(emptyDraft());
      toast.success(`${created.name} created`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create project');
    }
  }

  async function toggleStage(stageIndex) {
    if (!selected) return;
    const cur = selected.workflowStages?.[stageIndex];
    if (!cur) return;
    const next = cur.status === 'done' ? 'in_progress' : 'done';
    try {
      await Projects.updateStage(selected.id, stageIndex, { status: next, completed: next === 'done' });
      // optimistic update
      setProjects(prev => prev.map(p => {
        if (p.id !== selected.id) return p;
        const stages = [...(p.workflowStages || [])];
        stages[stageIndex] = { ...stages[stageIndex], status: next, completed: next === 'done' };
        return { ...p, workflowStages: stages };
      }));
    } catch (e) {
      console.error(e);
      toast.error('Failed to update stage');
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Project Management</h1>
          <p className="text-slate-600 mt-1">Pick a project to inspect its workflow stages</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800" data-testid="new-project-button">
              <Plus className="w-4 h-4 mr-2" />New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
              <DialogDescription>Add a project for a client</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              <F label="Name *"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Nike Holiday 2026" /></F>
              <F label="Client *">
                <Select value={draft.clientId} onValueChange={(v) => setDraft({ ...draft, clientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="SOW"><Textarea rows={2} value={draft.sow} onChange={e => setDraft({ ...draft, sow: e.target.value })} placeholder="60s hero + 6 cutdowns" /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Start *"><Input type="date" value={draft.projectStartDate} onChange={e => setDraft({ ...draft, projectStartDate: e.target.value })} /></F>
                <F label="End *"><Input type="date" value={draft.projectEndDate} onChange={e => setDraft({ ...draft, projectEndDate: e.target.value })} /></F>
                <F label="Pod">
                  <Select value={draft.podId} onValueChange={(v) => setDraft({ ...draft, podId: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Type">
                  <Select value={draft.projectType} onValueChange={(v) => setDraft({ ...draft, projectType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="tech">Tech</SelectItem>
                      <SelectItem value="lifestyle">Lifestyle</SelectItem>
                      <SelectItem value="food">Food & Beverage</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
                <F label="PM">
                  <Select value={draft.assignedPMUserId} onValueChange={(v) => setDraft({ ...draft, assignedPMUserId: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {usersByRole.project_manager.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <F label="AM">
                  <Select value={draft.assignedAMUserId} onValueChange={(v) => setDraft({ ...draft, assignedAMUserId: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {usersByRole.account_manager.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <F label="LP">
                  <Select value={draft.assignedLPUserId} onValueChange={(v) => setDraft({ ...draft, assignedLPUserId: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {usersByRole.line_producer.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Budget (₹)"><Input type="number" min="0" value={draft.budgetINR} onChange={e => setDraft({ ...draft, budgetINR: e.target.value })} /></F>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={createProject} className="bg-slate-900 hover:bg-slate-800" data-testid="save-project-button">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 shadow-sm md:col-span-1">
          <CardHeader><CardTitle className="text-base">Projects ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No projects.</div>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto">
                {filtered.map(p => {
                  const isSelected = p.id === selectedId;
                  const clientName = clients.find(c => c.id === p.clientId)?.name || '—';
                  const podName = pods.find(pd => pd.id === p.podId)?.name || '';
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setSelectedId(p.id)}
                        data-testid={`pm-project-${p.id}`}
                        className={`w-full text-left p-3 border-l-4 ${isSelected ? 'border-slate-900 bg-slate-50' : 'border-transparent hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-900 truncate">{p.name}</p>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                        <p className="text-xs text-slate-500 truncate">{clientName}{podName ? ` · ${podName}` : ''}</p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{p.projectStartDate || '—'} → {p.projectEndDate || '—'}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          {!selected ? (
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center text-slate-500">
                Pick a project on the left to view its workflow.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{selected.name}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">
                        {clients.find(c => c.id === selected.clientId)?.name || '—'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/project/${selected.id}`)}>
                      Open detail
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span className="font-mono">{selected.projectStartDate} → {selected.projectEndDate}</span></span>
                    {selected.budgetINR > 0 && <span className="font-mono">₹{(selected.budgetINR / 100000).toFixed(1)}L</span>}
                    <Badge className="text-xs rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                      {(selected.statusCategory || 'active').replace('_', ' ')}
                    </Badge>
                  </div>

                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Workflow stages</p>
                  <ul className="space-y-2">
                    {(selected.workflowStages || []).map((s, idx) => {
                      const done = s.status === 'done' || s.completed;
                      const active = s.status === 'in_progress';
                      const deptColor = STAGE_DEPT_COLORS[s.department] || 'bg-slate-400';
                      return (
                        <li key={idx} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
                          <button
                            className="shrink-0"
                            onClick={() => toggleStage(idx)}
                            title={done ? 'Mark in progress' : 'Mark done'}
                          >
                            {done
                              ? <CheckCircle className="w-5 h-5 text-green-600" />
                              : <Circle className={`w-5 h-5 ${active ? 'text-slate-900 fill-current' : 'text-slate-300'}`} />}
                          </button>
                          <span className={`inline-block w-2 h-6 rounded ${deptColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${done ? 'line-through text-slate-400' : 'text-slate-900'}`}>{s.name}</span>
                              <Badge className="text-[10px] rounded-full border bg-slate-50 text-slate-600 border-slate-200">{s.taskType}</Badge>
                              {active && <Badge className="text-[10px] rounded-full border bg-blue-50 text-blue-700 border-blue-200">in progress</Badge>}
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono">{s.startDate || '—'} → {s.endDate || '—'} · {s.duration || 0}d{s.extraDays ? ` (+${s.extraDays})` : ''}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

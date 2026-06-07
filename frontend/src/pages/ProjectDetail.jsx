import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Users as UsersIcon, Plus, CheckCircle, Circle,
  Layers, FilmIcon, Film, ListChecks, ShieldCheck, MessageSquare,
  CalendarRange, Wallet, Receipt, Printer, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Projects, Clients as ClientsApi, Users as UsersApi,
  Campaigns, Deliverables, Phases, Tasks, Subtasks, Approvals,
  Departments, TimeEntries,
} from '@/lib/api';
import RoundsDrawer from '@/components/RoundsDrawer';
import Gantt from '@/components/Gantt';

const TASK_STATUS_STYLES = {
  todo:         'bg-slate-50 text-slate-700 border-slate-200',
  in_progress:  'bg-blue-50 text-blue-700 border-blue-200',
  review:       'bg-violet-50 text-violet-700 border-violet-200',
  done:         'bg-green-50 text-green-700 border-green-200',
  blocked:      'bg-red-50 text-red-700 border-red-200',
};
const PRIORITY_STYLES = {
  low:    'bg-slate-50 text-slate-700 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high:   'bg-red-50 text-red-700 border-red-200',
};
const APPROVAL_STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-green-50 text-green-700 border-green-200',
  rejected:  'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};
const DELIVERABLE_STATUS_STYLES = TASK_STATUS_STYLES;

export default function ProjectDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [client, setClient] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [phases, setPhases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [subtasksByTask, setSubtasksByTask] = useState({});
  const [approvals, setApprovals] = useState([]);

  useEffect(() => { (async () => { await loadAll(); })(); }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const proj = await Projects.get(id);
      setProject(proj);

      const [c, allUsers, camps, delivs, phs, ts, apps] = await Promise.all([
        ClientsApi.get(proj.clientId).catch(() => null),
        UsersApi.list({ agencyId: proj.agencyId }),
        Campaigns.listForProject(id),
        Deliverables.listForProject(id),
        Phases.listForProject(id),
        Tasks.forProject(id),
        Approvals.forProject(id),
      ]);
      setClient(c);
      const byId = Object.fromEntries(allUsers.map(u => [u.id, u]));
      setUsersById(byId);
      // Resolve the logged-in user's id from their email (demo auth only
      // carries email + name in localStorage).
      const me = user?.email ? allUsers.find(u => u.email === user.email) : null;
      setCurrentUserId(me?.id || null);
      setCampaigns(camps);
      setDeliverables(delivs);
      setPhases(phs);
      setTasks(ts);
      setApprovals(apps);

      const subEntries = await Promise.all(
        ts.map(async t => [t.id, await Subtasks.listForTask(t.id)])
      );
      setSubtasksByTask(Object.fromEntries(subEntries));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  const tasksByPhase = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      (m[t.phaseId] = m[t.phaseId] || []).push(t);
    }
    return m;
  }, [tasks]);

  const userName = (uid) => usersById[uid]?.shortName || usersById[uid]?.name || (uid ? '—' : '—');

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!project) return <div className="p-8 text-slate-500">Project not found.</div>;

  const canEdit = user?.role === 'project_manager' || user?.role === 'line_producer';

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-slate-600 mt-1">
              {client ? (
                <button onClick={() => navigate(`/clients/${client.id}`)} className="hover:underline">
                  {client.name}
                </button>
              ) : '—'}
            </p>
            {project.sow && <p className="text-sm text-slate-500 mt-2">{project.sow}</p>}
            <div className="flex items-center flex-wrap gap-4 mt-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span className="font-mono">{project.projectStartDate || '—'} → {project.projectEndDate || '—'}</span>
              </span>
              <span className="flex items-center gap-1">
                <UsersIcon className="w-4 h-4" /> PM: {userName(project.assignedPMUserId)}
              </span>
              <span>AM: {userName(project.assignedAMUserId)}</span>
              <span>LP: {userName(project.assignedLPUserId)}</span>
              {project.budgetINR > 0 && (
                <span className="font-mono">₹{(project.budgetINR / 100000).toFixed(1)}L</span>
              )}
            </div>
          </div>
          <Badge className="text-xs rounded-full border bg-blue-50 text-blue-700 border-blue-200 self-start">
            {(project.statusCategory || 'active').replace('_', ' ')}
          </Badge>
        </div>

        <WorkflowStepper stages={project.workflowStages || []} />
      </div>

      <Tabs defaultValue="phases" className="w-full">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="phases" data-testid="tab-phases"><Layers className="w-4 h-4 mr-2" />Phases & Tasks</TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline"><CalendarRange className="w-4 h-4 mr-2" />Timeline</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns"><FilmIcon className="w-4 h-4 mr-2" />Campaigns</TabsTrigger>
          <TabsTrigger value="deliverables" data-testid="tab-deliverables"><Film className="w-4 h-4 mr-2" />Deliverables</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals"><ShieldCheck className="w-4 h-4 mr-2" />Approvals</TabsTrigger>
          <TabsTrigger value="financials" data-testid="tab-financials"><Wallet className="w-4 h-4 mr-2" />Financials</TabsTrigger>
        </TabsList>

        <TabsContent value="phases" className="mt-4">
          <PhasesTab
            project={project} phases={phases} tasksByPhase={tasksByPhase}
            subtasksByTask={subtasksByTask} usersById={usersById} canEdit={canEdit}
            currentUserId={currentUserId}
            onChanged={loadAll}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineTab project={project} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab project={project} campaigns={campaigns} canEdit={canEdit} onChanged={loadAll} />
        </TabsContent>

        <TabsContent value="deliverables" className="mt-4">
          <DeliverablesTab
            project={project} deliverables={deliverables} campaigns={campaigns}
            usersById={usersById} canEdit={canEdit} onChanged={loadAll}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <ApprovalsTab
            project={project} approvals={approvals} usersById={usersById}
            user={user} onChanged={loadAll}
          />
        </TabsContent>

        <TabsContent value="financials" className="mt-4">
          <FinancialsTab project={project} usersById={usersById} tasks={tasks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Stepper ----------

function WorkflowStepper({ stages }) {
  if (!stages || stages.length === 0) return null;
  const activeIdx = stages.findIndex(s => s.status === 'in_progress');
  return (
    <div className="mt-6 pt-6 border-t border-slate-200">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Workflow</p>
      <div className="flex items-center overflow-x-auto pb-2">
        {stages.map((s, i) => {
          const done = s.status === 'done' || s.completed;
          const active = !done && i === activeIdx;
          return (
            <div key={i} className="flex items-center shrink-0">
              <div className="flex flex-col items-center min-w-[80px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  done ? 'bg-green-500 border-green-500'
                       : active ? 'bg-slate-900 border-slate-900'
                                : 'bg-white border-slate-300'
                }`}>
                  {done ? <CheckCircle className="w-4 h-4 text-white" />
                        : active ? <Circle className="w-4 h-4 text-white fill-current" />
                                 : <Circle className="w-4 h-4 text-slate-300" />}
                </div>
                <p className={`text-[10px] mt-1 text-center font-medium ${
                  active ? 'text-slate-900' : 'text-slate-500'
                }`}>{s.name}</p>
              </div>
              {i < stages.length - 1 && (
                <div className={`w-6 h-0.5 mx-1 ${done ? 'bg-green-500' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Phases tab ----------

function PhasesTab({ project, phases, tasksByPhase, subtasksByTask, usersById, canEdit, onChanged, currentUserId }) {
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState({ open: false, phaseId: null });
  const [phaseDraft, setPhaseDraft] = useState({ name: '', plannedStart: '', plannedEnd: '' });
  const [taskDraft, setTaskDraft] = useState({ name: '', description: '', assigneeUserId: '', priority: 'medium', plannedStart: '', plannedEnd: '', estimateHrs: 0 });

  // ---- Live-timer state (per current user) ----
  const [activeTimer, setActiveTimer] = useState(null);  // null | {id, taskId, projectId, startedAt}
  const [, setTickNow] = useState(Date.now());

  useEffect(() => { (async () => {
    if (!currentUserId) return;
    try { setActiveTimer(await TimeEntries.activeFor(currentUserId)); }
    catch (e) { /* ignore */ }
  })(); }, [currentUserId]);

  useEffect(() => {
    if (!activeTimer) return;
    const h = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [activeTimer]);

  async function startTimer(task) {
    if (!currentUserId) return toast.error('Cannot resolve user — relogin');
    try {
      const s = await TimeEntries.startTimer({
        agencyId: project.agencyId,
        userId: currentUserId,
        projectId: project.id,
        taskId: task.id,
        billable: true,
      });
      setActiveTimer(s);
      toast.success(`Timer started on "${task.name}"`);
    } catch (e) { console.error(e); toast.error('Failed to start timer'); }
  }

  async function stopTimer() {
    if (!currentUserId) return;
    try {
      const entry = await TimeEntries.stopTimer(currentUserId);
      setActiveTimer(null);
      toast.success(`Logged ${entry.hours}h`);
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed to stop timer'); }
  }

  const allUsers = Object.values(usersById);

  async function createPhase() {
    if (!phaseDraft.name) return toast.error('Phase name required');
    try {
      await Phases.create({
        projectId: project.id,
        name: phaseDraft.name,
        order: phases.length + 1,
        plannedStart: phaseDraft.plannedStart || null,
        plannedEnd: phaseDraft.plannedEnd || null,
      });
      setPhaseDialogOpen(false);
      setPhaseDraft({ name: '', plannedStart: '', plannedEnd: '' });
      toast.success('Phase added');
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed to add phase'); }
  }

  async function createTask() {
    if (!taskDraft.name) return toast.error('Task name required');
    try {
      await Tasks.create({
        projectId: project.id,
        phaseId: taskDialog.phaseId,
        name: taskDraft.name,
        description: taskDraft.description || null,
        assigneeUserId: taskDraft.assigneeUserId || null,
        priority: taskDraft.priority,
        plannedStart: taskDraft.plannedStart || null,
        plannedEnd: taskDraft.plannedEnd || null,
        estimateHrs: Number(taskDraft.estimateHrs) || 0,
      });
      setTaskDialog({ open: false, phaseId: null });
      setTaskDraft({ name: '', description: '', assigneeUserId: '', priority: 'medium', plannedStart: '', plannedEnd: '', estimateHrs: 0 });
      toast.success('Task added');
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed to add task'); }
  }

  async function toggleTaskStatus(t) {
    const next = t.status === 'done' ? 'todo' : 'done';
    try {
      await Tasks.update(t.id, { status: next });
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed to update task'); }
  }

  async function toggleSubtask(s) {
    try {
      await Subtasks.update(s.id, { done: !s.done });
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed to update'); }
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Phases</CardTitle>
        {canEdit && (
          <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800" data-testid="add-phase-button">
                <Plus className="w-4 h-4 mr-2" />Add Phase
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Phase</DialogTitle>
                <DialogDescription>Group tasks into a project phase</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <Labeled label="Name *">
                  <Input value={phaseDraft.name} onChange={e => setPhaseDraft({ ...phaseDraft, name: e.target.value })} placeholder="Concepting" />
                </Labeled>
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Planned start"><Input type="date" value={phaseDraft.plannedStart} onChange={e => setPhaseDraft({ ...phaseDraft, plannedStart: e.target.value })} /></Labeled>
                  <Labeled label="Planned end"><Input type="date" value={phaseDraft.plannedEnd} onChange={e => setPhaseDraft({ ...phaseDraft, plannedEnd: e.target.value })} /></Labeled>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPhaseDialogOpen(false)}>Cancel</Button>
                <Button onClick={createPhase} className="bg-slate-900 hover:bg-slate-800">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {phases.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No phases yet. Add one to organize tasks.</p>
        ) : (
          <div className="space-y-4">
            {phases.map(ph => {
              const ts = tasksByPhase[ph.id] || [];
              return (
                <div key={ph.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-slate-50 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">{ph.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        {ph.plannedStart || '—'} → {ph.plannedEnd || '—'} · {ts.length} task{ts.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs rounded-full border ${TASK_STATUS_STYLES[ph.status] || TASK_STATUS_STYLES.todo}`}>
                        {ph.status?.replace('_', ' ') || 'not started'}
                      </Badge>
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => setTaskDialog({ open: true, phaseId: ph.id })}>
                          <Plus className="w-3 h-3 mr-1" />Task
                        </Button>
                      )}
                    </div>
                  </div>
                  {ts.length > 0 && (
                    <ul className="divide-y divide-slate-100">
                      {ts.map(t => (
                        <li key={t.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTaskStatus(t)} className="mt-1" />
                            <TaskTimerButton
                              task={t}
                              activeTimer={activeTimer}
                              onStart={startTimer}
                              onStop={stopTimer}
                              canTime={!!currentUserId}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                  {t.name}
                                </span>
                                <Badge className={`text-xs rounded-full border ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium}`}>
                                  {t.priority}
                                </Badge>
                                <Badge className={`text-xs rounded-full border ${TASK_STATUS_STYLES[t.status] || TASK_STATUS_STYLES.todo}`}>
                                  {t.status?.replace('_', ' ') || 'todo'}
                                </Badge>
                              </div>
                              {t.description && <p className="text-xs text-slate-600 mt-1">{t.description}</p>}
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span>{usersById[t.assigneeUserId]?.shortName || usersById[t.assigneeUserId]?.name || 'Unassigned'}</span>
                                <span className="font-mono">{t.plannedStart || '—'} → {t.plannedEnd || '—'}</span>
                                {t.estimateHrs > 0 && <span>{t.estimateHrs}h est.</span>}
                              </div>
                              {(subtasksByTask[t.id] || []).length > 0 && (
                                <ul className="mt-2 ml-2 space-y-1">
                                  {subtasksByTask[t.id].map(s => (
                                    <li key={s.id} className="flex items-center gap-2 text-xs">
                                      <Checkbox checked={s.done} onCheckedChange={() => toggleSubtask(s)} />
                                      <span className={s.done ? 'line-through text-slate-400' : 'text-slate-700'}>{s.name}</span>
                                      {s.assigneeUserId && (
                                        <span className="text-slate-500">— {usersById[s.assigneeUserId]?.shortName || ''}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={taskDialog.open} onOpenChange={(o) => setTaskDialog({ ...taskDialog, open: o })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
              <DialogDescription>Add a task to this phase</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[55vh] overflow-y-auto">
              <Labeled label="Name *"><Input value={taskDraft.name} onChange={e => setTaskDraft({ ...taskDraft, name: e.target.value })} placeholder="Scout 2 locations in Bengaluru" /></Labeled>
              <Labeled label="Description"><Textarea rows={3} value={taskDraft.description} onChange={e => setTaskDraft({ ...taskDraft, description: e.target.value })} /></Labeled>
              <div className="grid grid-cols-2 gap-3">
                <Labeled label="Assignee">
                  <Select value={taskDraft.assigneeUserId} onValueChange={(v) => setTaskDraft({ ...taskDraft, assigneeUserId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent>
                      {allUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Labeled>
                <Labeled label="Priority">
                  <Select value={taskDraft.priority} onValueChange={(v) => setTaskDraft({ ...taskDraft, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </Labeled>
                <Labeled label="Planned start"><Input type="date" value={taskDraft.plannedStart} onChange={e => setTaskDraft({ ...taskDraft, plannedStart: e.target.value })} /></Labeled>
                <Labeled label="Planned end"><Input type="date" value={taskDraft.plannedEnd} onChange={e => setTaskDraft({ ...taskDraft, plannedEnd: e.target.value })} /></Labeled>
                <Labeled label="Estimate (hrs)"><Input type="number" min="0" value={taskDraft.estimateHrs} onChange={e => setTaskDraft({ ...taskDraft, estimateHrs: e.target.value })} /></Labeled>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskDialog({ open: false, phaseId: null })}>Cancel</Button>
              <Button onClick={createTask} className="bg-slate-900 hover:bg-slate-800">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ---------- Timeline tab ----------

function TimelineTab({ project }) {
  const [schedule, setSchedule] = useState(null);
  const [departmentsById, setDepartmentsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => { (async () => {
    setLoading(true);
    setErr(null);
    try {
      const [s, depts] = await Promise.all([
        Projects.schedule(project.id),
        Departments.list(project.agencyId).catch(() => []),
      ]);
      setSchedule(s);
      setDepartmentsById(Object.fromEntries(depts.map(d => [d.id, d])));
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.detail || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  })(); }, [project.id, project.agencyId]);

  if (loading) {
    return <Card className="border border-slate-200 shadow-sm"><CardContent className="py-12 text-center text-slate-500">Computing schedule…</CardContent></Card>;
  }
  if (err) {
    return <Card className="border border-red-200 shadow-sm"><CardContent className="py-12 text-center text-red-700">{err}</CardContent></Card>;
  }
  if (!schedule || !schedule.tasks?.length) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="py-12 text-center text-slate-500">
          No tasks scheduled yet. Add phases + tasks in the Phases & Tasks tab to see them here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
        <div>
          Span: <span className="font-mono">{schedule.projectStart} → {schedule.projectEnd}</span>
        </div>
        <div>
          {schedule.tasks.length} tasks · {schedule.criticalPath.length} on critical path · {schedule.holidays.length} holiday{schedule.holidays.length === 1 ? '' : 's'} in window
        </div>
      </div>
      <Gantt schedule={schedule} departmentsById={departmentsById} />
    </div>
  );
}

// ---------- Campaigns tab ----------

function CampaignsTab({ project, campaigns, canEdit, onChanged }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', brief: '', startDate: '', endDate: '' });

  async function create() {
    if (!draft.name) return toast.error('Name required');
    try {
      await Campaigns.create({
        projectId: project.id,
        name: draft.name,
        brief: draft.brief || null,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
      });
      setDialogOpen(false);
      setDraft({ name: '', brief: '', startDate: '', endDate: '' });
      toast.success('Campaign added');
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed to create'); }
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Campaigns</CardTitle>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800" data-testid="add-campaign-button">
                <Plus className="w-4 h-4 mr-2" />Add Campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Campaign</DialogTitle>
                <DialogDescription>Group deliverables under a campaign</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <Labeled label="Name *"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Hero Film" /></Labeled>
                <Labeled label="Brief"><Textarea rows={3} value={draft.brief} onChange={e => setDraft({ ...draft, brief: e.target.value })} /></Labeled>
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Start"><Input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></Labeled>
                  <Labeled label="End"><Input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} /></Labeled>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={create} className="bg-slate-900 hover:bg-slate-800">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No campaigns yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {campaigns.map(c => (
              <div key={c.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-slate-900">{c.name}</h3>
                  <Badge className={`text-xs rounded-full border ${TASK_STATUS_STYLES[c.status] || TASK_STATUS_STYLES.todo}`}>
                    {c.status?.replace('_', ' ')}
                  </Badge>
                </div>
                {c.brief && <p className="text-xs text-slate-600 mt-2">{c.brief}</p>}
                <p className="text-xs text-slate-500 mt-2 font-mono">{c.startDate || '—'} → {c.endDate || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Deliverables tab ----------

function DeliverablesTab({ project, deliverables, campaigns, usersById, canEdit, onChanged, currentUserId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', type: 'video', dueDate: '', campaignId: '', ownerUserId: '', status: 'todo' });
  const [roundsFor, setRoundsFor] = useState(null);   // deliverable | null
  const users = Object.values(usersById);

  async function create() {
    if (!draft.name) return toast.error('Name required');
    try {
      await Deliverables.create({
        projectId: project.id,
        campaignId: draft.campaignId || null,
        name: draft.name,
        type: draft.type,
        dueDate: draft.dueDate || null,
        ownerUserId: draft.ownerUserId || null,
        status: draft.status,
      });
      setDialogOpen(false);
      setDraft({ name: '', type: 'video', dueDate: '', campaignId: '', ownerUserId: '', status: 'todo' });
      toast.success('Deliverable added');
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed to create'); }
  }

  const campaignName = (cid) => campaigns.find(c => c.id === cid)?.name || '—';

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Deliverables</CardTitle>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800" data-testid="add-deliverable-button">
                <Plus className="w-4 h-4 mr-2" />Add Deliverable
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Deliverable</DialogTitle></DialogHeader>
              <div className="space-y-3 py-4">
                <Labeled label="Name *"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="60s Hero Film" /></Labeled>
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Type">
                    <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="static">Static</SelectItem>
                        <SelectItem value="reel">Reel</SelectItem>
                        <SelectItem value="photo">Photo</SelectItem>
                        <SelectItem value="copy">Copy</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Labeled>
                  <Labeled label="Due"><Input type="date" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></Labeled>
                  <Labeled label="Campaign">
                    <Select value={draft.campaignId} onValueChange={(v) => setDraft({ ...draft, campaignId: v })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Labeled>
                  <Labeled label="Owner">
                    <Select value={draft.ownerUserId} onValueChange={(v) => setDraft({ ...draft, ownerUserId: v })}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Labeled>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={create} className="bg-slate-900 hover:bg-slate-800">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {deliverables.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No deliverables yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Campaign</th>
                  <th className="text-left p-3">Owner</th>
                  <th className="text-left p-3">Due</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Rounds</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map(d => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{d.name}</td>
                    <td className="p-3 text-slate-600">{d.type}</td>
                    <td className="p-3 text-slate-600">{campaignName(d.campaignId)}</td>
                    <td className="p-3 text-slate-600">{usersById[d.ownerUserId]?.shortName || usersById[d.ownerUserId]?.name || '—'}</td>
                    <td className="p-3 font-mono text-xs text-slate-500">{d.dueDate || '—'}</td>
                    <td className="p-3">
                      <Badge className={`text-xs rounded-full border ${DELIVERABLE_STATUS_STYLES[d.status] || DELIVERABLE_STATUS_STYLES.todo}`}>
                        {d.status?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRoundsFor(d)}
                        data-testid={`open-rounds-${d.id}`}
                      >
                        Rounds
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <RoundsDrawer
          open={!!roundsFor}
          onOpenChange={(o) => !o && setRoundsFor(null)}
          deliverable={roundsFor}
          currentUserId={currentUserId}
        />
      </CardContent>
    </Card>
  );
}

// ---------- Financials tab ----------

const fmtINR = (n) => {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

function FinancialsTab({ project, usersById, tasks }) {
  const navigate = useNavigate();
  const [fin, setFin] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const tasksById = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const [f, es] = await Promise.all([
        Projects.financials(project.id),
        TimeEntries.list({ projectId: project.id }),
      ]);
      setFin(f);
      setEntries(es);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load financials');
    } finally {
      setLoading(false);
    }
  })(); }, [project.id]);

  if (loading) return <Card className="border border-slate-200 shadow-sm"><CardContent className="py-12 text-center text-slate-500">Loading…</CardContent></Card>;
  if (!fin) return null;

  const budgetUsed = fin.budgetUsedPct;
  const marginColor = (fin.marginPct ?? 0) >= 30 ? 'text-green-700' : (fin.marginPct ?? 0) >= 10 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinCard label="Budget"        value={fmtINR(fin.budgetINR)} color="violet" />
        <FinCard label="Billed"        value={fmtINR(fin.billableInr)} foot={`${fin.billableHours}h billable`} color="blue" />
        <FinCard label="Internal cost" value={fmtINR(fin.internalCostInr)} foot={`${fin.internalHours}h internal`} color="amber" />
        <FinCard label="Profit"        value={fmtINR(fin.profit)} foot={fin.marginPct !== null ? `${fin.marginPct}% margin` : '—'} color={(fin.marginPct ?? 0) >= 30 ? 'green' : (fin.marginPct ?? 0) >= 10 ? 'amber' : 'red'} />
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4" />Time entries ({entries.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            {budgetUsed !== null && (
              <span className="text-xs text-slate-500">budget used: <span className={`font-mono ${budgetUsed > 100 ? 'text-red-700 font-bold' : 'text-slate-700'}`}>{budgetUsed}%</span></span>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate(`/invoice/${project.id}`)}>
              <Printer className="w-4 h-4 mr-2" />Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No time logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Task</th>
                    <th className="text-right p-3">Hours</th>
                    <th className="text-right p-3">Rate</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-center p-3">Type</th>
                    <th className="text-left p-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const u = usersById[e.userId];
                    const t = tasksById[e.taskId];
                    const amt = e.hours * e.billRateINRSnapshot;
                    return (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="p-3 font-mono text-xs">{e.date}</td>
                        <td className="p-3">{u?.shortName || u?.name || '—'}</td>
                        <td className="p-3">{t?.name || '—'}</td>
                        <td className="p-3 text-right font-mono">{e.hours.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-slate-600">₹{e.billRateINRSnapshot.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono">{fmtINR(amt)}</td>
                        <td className="p-3 text-center">
                          <Badge className={`text-xs rounded-full border ${e.billable ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {e.billable ? 'billable' : 'internal'}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-slate-600 max-w-[20rem] truncate">{e.notes || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const FIN_COLOR = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600' },
};

function FinCard({ label, value, foot, color = 'violet' }) {
  const c = FIN_COLOR[color] || FIN_COLOR.violet;
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-2 ${c.text}`}>{value}</p>
        {foot && <p className="text-xs text-slate-500 mt-1">{foot}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- Approvals tab ----------

function ApprovalsTab({ project, approvals, usersById, user, onChanged }) {
  async function decide(a, decision) {
    try {
      await Approvals.decide(a.id, { decision, decidedBy: user?.name || 'unknown', note: null });
      toast.success(`Approval ${decision}`);
      onChanged();
    } catch (e) { console.error(e); toast.error('Failed'); }
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Approval Queue</CardTitle>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No approvals.</p>
        ) : (
          <div className="space-y-3">
            {approvals.map(a => (
              <div key={a.id} className="border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs rounded-full border ${a.scope === 'client' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {a.scope}
                    </Badge>
                    <Badge className={`text-xs rounded-full border ${APPROVAL_STATUS_STYLES[a.status]}`}>{a.status}</Badge>
                    <span className="text-xs text-slate-500">on {a.subjectType}</span>
                  </div>
                  {a.note && (
                    <p className="text-sm text-slate-700 mt-2 flex items-start gap-1">
                      <MessageSquare className="w-3 h-3 mt-1 shrink-0" />{a.note}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Requested by {usersById[a.requesterUserId]?.name || 'unknown'}
                    {a.decidedBy && ` · Decided by ${a.decidedBy}`}
                  </p>
                  {a.scope === 'client' && a.magicLinkToken && a.status === 'pending' && (
                    <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                      Magic link: /api/public/approvals/{a.magicLinkToken}
                    </p>
                  )}
                </div>
                {a.status === 'pending' && a.scope === 'internal' && a.reviewerUserIds?.includes(user?.id) !== false && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => decide(a, 'approved')}>Approve</Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => decide(a, 'rejected')}>Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Labeled({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Inline Start/Stop button for a single task. Re-renders every second when
 * a timer is running so the elapsed badge stays live.
 */
function TaskTimerButton({ task, activeTimer, onStart, onStop, canTime }) {
  if (!canTime) return null;
  const running = activeTimer && activeTimer.taskId === task.id;
  const otherRunning = activeTimer && activeTimer.taskId !== task.id;

  if (running) {
    const elapsedMs = Date.now() - new Date(activeTimer.startedAt).getTime();
    const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onStop}
        data-testid={`timer-stop-${task.id}`}
        className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 font-mono"
        title="Stop timer and log the elapsed time"
      >
        <span className="inline-block w-2 h-2 bg-red-600 rounded-sm mr-2 animate-pulse" />
        {hh}:{mm}:{ss}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => onStart(task)}
      disabled={!!otherRunning}
      data-testid={`timer-start-${task.id}`}
      className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      title={otherRunning ? 'Another timer is running — stop it first' : 'Start timer for this task'}
    >
      <Clock className="w-4 h-4" />
    </Button>
  );
}

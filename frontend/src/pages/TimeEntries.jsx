import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Agencies, Projects, Tasks, Users as UsersApi, TimeEntries as TimeApi,
} from '@/lib/api';

export default function TimeEntries({ user }) {
  const navigate = useNavigate();
  const [agencyId, setAgencyId] = useState(null);
  const [meId, setMeId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => format(addDays(new Date(), -14), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(addDays(new Date(), 14), 'yyyy-MM-dd'));
  const [userFilter, setUserFilter] = useState('me');
  const [projectFilter, setProjectFilter] = useState('all');
  const [logOpen, setLogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  const canSeeAll = user?.role === 'project_manager' || user?.role === 'account_manager';

  function emptyDraft() {
    return {
      projectId: '', taskId: '', date: format(new Date(), 'yyyy-MM-dd'),
      hours: 0, billable: true, notes: '',
    };
  }

  useEffect(() => { (async () => {
    try {
      const ags = await Agencies.list();
      const aid = ags[0]?.id;
      setAgencyId(aid);
      const [ps, us] = await Promise.all([
        Projects.list(aid ? { agencyId: aid } : undefined),
        UsersApi.list({ agencyId: aid }),
      ]);
      setProjects(ps);
      setUsers(us);
      const me = us.find(u => u.email === user?.email);
      setMeId(me?.id || null);
      // Default userFilter for non-admin roles = self.
      if (!canSeeAll && me) setUserFilter(me.id);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load reference data');
    }
  })(); }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { (async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const params = { agencyId, fromDate: from, toDate: to };
      if (projectFilter !== 'all') params.projectId = projectFilter;
      if (userFilter === 'me' && meId) params.userId = meId;
      else if (userFilter !== 'all' && userFilter !== 'me') params.userId = userFilter;
      setEntries(await TimeApi.list(params));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load time entries');
    } finally {
      setLoading(false);
    }
  })(); }, [agencyId, from, to, projectFilter, userFilter, meId]);

  // Lazy-load tasks when a project is picked in the form.
  useEffect(() => { (async () => {
    if (!draft.projectId) { setTasks([]); return; }
    try {
      setTasks(await Tasks.forProject(draft.projectId));
    } catch (e) {
      console.error(e);
    }
  })(); }, [draft.projectId]);

  const usersById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);
  const projectsById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const tasksById = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);

  const totals = useMemo(() => {
    let billH = 0, intH = 0;
    for (const e of entries) {
      if (e.billable) billH += e.hours;
      else intH += e.hours;
    }
    return { billH: Math.round(billH * 100) / 100, intH: Math.round(intH * 100) / 100 };
  }, [entries]);

  async function createEntry() {
    if (!draft.projectId) return toast.error('Pick a project');
    if (!draft.hours || draft.hours <= 0) return toast.error('Hours must be > 0');
    if (!meId) return toast.error('Cannot resolve your user record — try relogin');
    try {
      await TimeApi.create({
        agencyId,
        projectId: draft.projectId,
        taskId: draft.taskId || null,
        userId: meId,
        date: draft.date,
        hours: Number(draft.hours),
        billable: draft.billable,
        notes: draft.notes || null,
      });
      toast.success('Logged');
      setLogOpen(false);
      setDraft(emptyDraft());
      // Trigger a refetch by bumping a filter (same effect as below would re-fire on prop change).
      const params = { agencyId, fromDate: from, toDate: to };
      if (projectFilter !== 'all') params.projectId = projectFilter;
      if (userFilter === 'me' && meId) params.userId = meId;
      else if (userFilter !== 'all' && userFilter !== 'me') params.userId = userFilter;
      setEntries(await TimeApi.list(params));
    } catch (e) {
      console.error(e);
      toast.error('Failed to log');
    }
  }

  async function deleteEntry(e) {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await TimeApi.delete(e.id);
      setEntries(prev => prev.filter(x => x.id !== e.id));
      toast.success('Deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete');
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Time entries</h1>
          <p className="text-slate-600 mt-1">
            {totals.billH}h billable · {totals.intH}h internal · {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} in window
          </p>
        </div>
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800" data-testid="log-time-button">
              <Plus className="w-4 h-4 mr-2" />Log time
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log time</DialogTitle>
              <DialogDescription>Quick entry. Rate snapshotted from your profile.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Field label="Project *">
                <Select value={draft.projectId} onValueChange={(v) => setDraft({ ...draft, projectId: v, taskId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Task (optional)">
                <Select value={draft.taskId} onValueChange={(v) => setDraft({ ...draft, taskId: v })} disabled={!draft.projectId || tasks.length === 0}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date"><Input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></Field>
                <Field label="Hours *"><Input type="number" step="0.25" min="0" value={draft.hours} onChange={e => setDraft({ ...draft, hours: e.target.value })} data-testid="log-hours-input" /></Field>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200">
                <Label className="text-sm">Billable to client</Label>
                <Switch checked={draft.billable} onCheckedChange={(v) => setDraft({ ...draft, billable: v })} />
              </div>
              <Field label="Notes"><Textarea rows={2} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
              <Button onClick={createEntry} className="bg-slate-900 hover:bg-slate-800" data-testid="save-log-button">Log</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex flex-wrap gap-3 items-end">
            <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} data-testid="time-from-input" /></Field>
            <Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} data-testid="time-to-input" /></Field>
            <Field label="Project">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {canSeeAll && (
              <Field label="User">
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="me">Me</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No entries.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Project</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-right p-3">Hours</th>
                    <th className="text-right p-3">₹/hr</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-center p-3">Type</th>
                    <th className="text-left p-3">Notes</th>
                    <th className="text-right p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const u = usersById[e.userId];
                    const p = projectsById[e.projectId];
                    const amt = e.hours * e.billRateINRSnapshot;
                    return (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="p-3 font-mono text-xs">{e.date}</td>
                        <td className="p-3">
                          <button onClick={() => navigate(`/project/${e.projectId}`)} className="hover:underline">
                            {p?.name || '—'}
                          </button>
                        </td>
                        <td className="p-3">{u?.shortName || u?.name || '—'}</td>
                        <td className="p-3 text-right font-mono">{e.hours.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-slate-600">{e.billRateINRSnapshot.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono">{Math.round(amt).toLocaleString('en-IN')}</td>
                        <td className="p-3 text-center">
                          <Badge className={`text-xs rounded-full border ${e.billable ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {e.billable ? 'billable' : 'internal'}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-slate-600 max-w-[18rem] truncate">{e.notes || ''}</td>
                        <td className="p-3 text-right">
                          {(canSeeAll || e.userId === meId) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => deleteEntry(e)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
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

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wide text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertCircle, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users as UsersApi, Tasks, Projects, Phases, Agencies } from '@/lib/api';

const PRIORITY_STYLES = {
  low:    'bg-slate-50 text-slate-700 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high:   'bg-red-50 text-red-700 border-red-200',
};
const STATUS_STYLES = {
  todo:        'bg-slate-50 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  review:      'bg-violet-50 text-violet-700 border-violet-200',
  done:        'bg-green-50 text-green-700 border-green-200',
  blocked:     'bg-red-50 text-red-700 border-red-200',
};

export default function TeamDashboard({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [projectsById, setProjectsById] = useState({});
  const [phasesById, setPhasesById] = useState({});
  const [statusFilter, setStatusFilter] = useState('open');

  useEffect(() => { (async () => {
    try {
      let userId = user?.id;
      if (!userId && user?.email) {
        try { userId = (await UsersApi.getByEmail(user.email))?.id; } catch (e) { /* not seeded */ }
      }
      if (!userId) {
        setTasks([]);
        return;
      }

      const myTasks = await Tasks.forUser(userId);
      setTasks(myTasks);

      const projectIds = [...new Set(myTasks.map(t => t.projectId))];
      const phaseIds   = [...new Set(myTasks.map(t => t.phaseId))];

      // Fetch related projects + phases for naming.
      const ags = await Agencies.list();
      const aid = ags[0]?.id;
      const [projs, allPhases] = await Promise.all([
        Projects.list(aid ? { agencyId: aid } : undefined),
        Promise.all(projectIds.map(pid => Phases.listForProject(pid))).then(arr => arr.flat()),
      ]);
      setProjectsById(Object.fromEntries(projs.map(p => [p.id, p])));
      setPhasesById(Object.fromEntries(allPhases.map(p => [p.id, p])));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  })(); }, [user?.id, user?.email]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    if (statusFilter === 'open') return tasks.filter(t => t.status !== 'done');
    if (statusFilter === 'done') return tasks.filter(t => t.status === 'done');
    return tasks.filter(t => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const stats = useMemo(() => {
    const pending = tasks.filter(t => t.status !== 'done').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter(t => t.status !== 'done' && t.plannedEnd && t.plannedEnd < today).length;
    return { pending, done, overdue };
  }, [tasks]);

  async function toggleDone(task) {
    const next = task.status === 'done' ? 'todo' : 'done';
    try {
      await Tasks.update(task.id, { status: next });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
      toast.success(next === 'done' ? 'Task completed' : 'Reopened');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update task');
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">My Tasks</h1>
        <p className="text-slate-600 mt-1">Track your assigned tasks and deadlines</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Pending"  value={stats.pending}  icon={Clock}        color="amber" testid="pending-tasks-card" />
        <KpiCard label="Completed" value={stats.done}    icon={CheckCircle}  color="green" testid="completed-tasks-card" />
        <KpiCard label="Overdue"  value={stats.overdue} icon={AlertCircle}  color="red"   testid="overdue-tasks-card" />
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Task List</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="todo">To do</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="review">In review</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {tasks.length === 0
                ? `No tasks assigned to you yet${user?.email ? '' : ' (no email on your profile)'}.`
                : 'No tasks match this filter.'}
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map(t => {
                const proj = projectsById[t.projectId];
                const ph = phasesById[t.phaseId];
                const today = new Date().toISOString().slice(0, 10);
                const overdue = t.status !== 'done' && t.plannedEnd && t.plannedEnd < today;
                return (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    data-testid={`task-item-${t.id}`}
                  >
                    <Checkbox
                      checked={t.status === 'done'}
                      onCheckedChange={() => toggleDone(t)}
                      className="mt-1"
                      data-testid={`task-checkbox-${t.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {t.name}
                        </span>
                        <Badge className={`text-xs rounded-full border ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium}`}>
                          {t.priority}
                        </Badge>
                        <Badge className={`text-xs rounded-full border ${STATUS_STYLES[t.status] || STATUS_STYLES.todo}`}>
                          {(t.status || 'todo').replace('_', ' ')}
                        </Badge>
                        {overdue && (
                          <Badge className="text-xs rounded-full border bg-red-50 text-red-700 border-red-200">overdue</Badge>
                        )}
                      </div>
                      {t.description && <p className="text-xs text-slate-600 mt-1">{t.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                        <button
                          className="hover:underline text-left truncate max-w-[18rem]"
                          onClick={() => proj && navigate(`/project/${proj.id}`)}
                        >
                          {proj?.name || 'Unknown project'}{ph ? ` · ${ph.name}` : ''}
                        </button>
                        <span className="font-mono">{t.plannedStart || '—'} → {t.plannedEnd || '—'}</span>
                        {t.estimateHrs > 0 && <span>{t.estimateHrs}h est.</span>}
                      </div>
                    </div>
                    {proj && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${proj.id}`)}>
                        Open
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const COLOR_CLASSES = {
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
};

function KpiCard({ label, value, icon: Icon, color, testid }) {
  const { bg, text } = COLOR_CLASSES[color] || COLOR_CLASSES.amber;
  return (
    <Card className="border border-slate-200 shadow-sm" data-testid={testid}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          </div>
          <div className={`${bg} p-3 rounded-lg`}>
            <Icon className={`w-6 h-6 ${text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

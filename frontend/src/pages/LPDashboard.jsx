import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, MapPin, Users as UsersIcon, Calendar, Film } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users as UsersApi, Projects, Clients as ClientsApi, Pods, Agencies } from '@/lib/api';

const PROJECT_STATUS_STYLES = {
  active:    'bg-blue-50 text-blue-700 border-blue-200',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};
const COLOR = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
};

const PRODUCTION_STAGES = new Set(['Pre Production', 'PPM', 'Shoot']);
const POST_STAGES       = new Set(['Edits', 'Feedback', 'Revision', 'Final Approval']);

export default function LPDashboard({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [clientsById, setClientsById] = useState({});
  const [podsById, setPodsById] = useState({});

  useEffect(() => { (async () => {
    try {
      let userId = user?.id;
      if (!userId && user?.email) {
        try { userId = (await UsersApi.getByEmail(user.email))?.id; } catch (e) {}
      }
      const ags = await Agencies.list();
      const aid = ags[0]?.id;

      const my = userId ? await Projects.list({ agencyId: aid, assignedLPUserId: userId }) : [];
      setProjects(my);

      const [clients, pods] = await Promise.all([
        ClientsApi.list(aid ? { agencyId: aid } : undefined),
        Pods.list(aid),
      ]);
      setClientsById(Object.fromEntries(clients.map(c => [c.id, c])));
      setPodsById(Object.fromEntries(pods.map(p => [p.id, p])));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load LP dashboard');
    } finally {
      setLoading(false);
    }
  })(); }, [user?.id, user?.email]);

  const inProduction = useMemo(() => projects.filter(p =>
    (p.workflowStages || []).some(s => PRODUCTION_STAGES.has(s.name) && s.status === 'in_progress')
  ), [projects]);

  const inPost = useMemo(() => projects.filter(p =>
    (p.workflowStages || []).some(s => POST_STAGES.has(s.name) && s.status === 'in_progress')
  ), [projects]);

  const upcomingShoots = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return projects
      .map(p => {
        const shoot = (p.workflowStages || []).find(s => s.name === 'Shoot');
        return shoot?.startDate && shoot.startDate >= today ? { project: p, date: shoot.startDate } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [projects]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Line Producer Dashboard</h1>
        <p className="text-slate-600 mt-1">Manage production schedules and resources</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="My Projects"   value={projects.length}    icon={Video}      color="violet" testid="total-projects-card" />
        <Kpi label="In Production" value={inProduction.length} icon={MapPin}    color="amber"  testid="in-production-card" />
        <Kpi label="In Post-Prod"  value={inPost.length}      icon={UsersIcon}  color="purple" testid="post-production-card" />
        <Kpi label="Upcoming Shoots" value={upcomingShoots.length} icon={Film}  color="blue"   testid="upcoming-shoots-card" />
      </div>

      {upcomingShoots.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Upcoming Shoots</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {upcomingShoots.map(({ project, date }) => (
                <li key={project.id} className="py-3 flex items-center justify-between">
                  <button onClick={() => navigate(`/project/${project.id}`)} className="text-left flex-1 min-w-0 hover:underline">
                    <p className="font-medium text-slate-900 truncate">{project.name}</p>
                    <p className="text-xs text-slate-500 truncate">{clientsById[project.clientId]?.name || '—'} · {podsById[project.podId]?.name || ''}</p>
                  </button>
                  <span className="text-sm font-mono text-slate-700">{date}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-lg">Production Schedule</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No projects assigned to you as LP yet.</div>
          ) : (
            <div className="space-y-2">
              {projects.map(p => {
                const active = (p.workflowStages || []).find(s => s.status === 'in_progress');
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/project/${p.id}`)}
                    data-testid={`project-item-${p.id}`}
                    className="w-full text-left flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-semibold text-slate-900 truncate">{p.name}</h3>
                        <Badge className={`text-xs rounded-full border ${PROJECT_STATUS_STYLES[p.statusCategory] || PROJECT_STATUS_STYLES.active}`}>
                          {(p.statusCategory || 'active').replace('_', ' ')}
                        </Badge>
                        {active && (
                          <Badge className="text-xs rounded-full border bg-blue-50 text-blue-700 border-blue-200">{active.name}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 truncate">{clientsById[p.clientId]?.name || '—'} · {podsById[p.podId]?.name || 'No Pod'}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500 shrink-0 ml-3">
                      <p className="flex items-center justify-end gap-1"><Calendar className="w-3 h-3" /><span className="font-mono">{p.projectEndDate || '—'}</span></p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color, testid }) {
  const c = COLOR[color] || COLOR.violet;
  return (
    <Card className="border border-slate-200 shadow-sm" data-testid={testid}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          </div>
          <div className={`${c.bg} p-3 rounded-lg`}>
            <Icon className={`w-6 h-6 ${c.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

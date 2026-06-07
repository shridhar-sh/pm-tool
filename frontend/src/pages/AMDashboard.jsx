import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Clock, AlertTriangle, ShieldCheck, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Users as UsersApi, Projects, Clients as ClientsApi, Approvals, Agencies, Pods } from '@/lib/api';

const PROJECT_STATUS_STYLES = {
  active:    'bg-blue-50 text-blue-700 border-blue-200',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};
const COLOR = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
};

export default function AMDashboard({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [clientsById, setClientsById] = useState({});
  const [podsById, setPodsById] = useState({});
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => { (async () => {
    try {
      let userId = user?.id;
      if (!userId && user?.email) {
        try { userId = (await UsersApi.getByEmail(user.email))?.id; } catch (e) {}
      }
      const ags = await Agencies.list();
      const aid = ags[0]?.id;

      const myProjects = userId
        ? await Projects.list({ agencyId: aid, assignedAMUserId: userId })
        : [];
      setProjects(myProjects);

      const [clients, pods] = await Promise.all([
        ClientsApi.list(aid ? { agencyId: aid } : undefined),
        Pods.list(aid),
      ]);
      setClientsById(Object.fromEntries(clients.map(c => [c.id, c])));
      setPodsById(Object.fromEntries(pods.map(p => [p.id, p])));

      // Pull every pending approval for my projects in parallel.
      const arrays = await Promise.all(myProjects.map(p => Approvals.forProject(p.id).catch(() => [])));
      const pend = arrays.flat().filter(a => a.status === 'pending');
      setPendingApprovals(pend);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load AM dashboard');
    } finally {
      setLoading(false);
    }
  })(); }, [user?.id, user?.email]);

  const followUp = useMemo(() => projects.filter(p => {
    const stages = p.workflowStages || [];
    return stages.some(s => (s.name === 'Onboarding' || s.name === 'Feedback' || s.name === 'Final Approval') && s.status === 'in_progress');
  }), [projects]);

  const delayed = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return projects.filter(p => p.projectEndDate && p.projectEndDate < today && p.statusCategory !== 'completed');
  }, [projects]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Account Manager Dashboard</h1>
        <p className="text-slate-600 mt-1">Track client communication and project progress</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="My Projects"    value={projects.length}        icon={Calendar}     color="violet" testid="total-projects-card" />
        <Kpi label="Needs Follow-up" value={followUp.length}       icon={Phone}        color="orange" testid="follow-up-card" />
        <Kpi label="Delayed"        value={delayed.length}         icon={AlertTriangle} color="red"   testid="delayed-card" />
        <Kpi label="Pending Approvals" value={pendingApprovals.length} icon={ShieldCheck} color="amber" testid="pending-approvals-card" />
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-lg">My Projects</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No projects assigned to you as AM yet.</div>
          ) : (
            <div className="space-y-2">
              {projects.map(p => (
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
                    </div>
                    <p className="text-sm text-slate-600 truncate">
                      {clientsById[p.clientId]?.name || '—'} · {podsById[p.podId]?.name || 'No Pod'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500 shrink-0 ml-3">
                    <p className="flex items-center justify-end gap-1"><Clock className="w-3 h-3" /><span className="font-mono">{p.projectEndDate || '—'}</span></p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingApprovals.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Approvals to Chase</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingApprovals.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs rounded-full border ${a.scope === 'client' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{a.scope}</Badge>
                      <span className="text-xs text-slate-500">on {a.subjectType}</span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs text-slate-500 truncate">{projects.find(p => p.id === a.projectId)?.name}</span>
                    </div>
                    {a.note && <p className="text-xs text-slate-600 mt-1 truncate">{a.note}</p>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/project/${a.projectId}`)}>Open</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {delayed.length > 0 && (
        <Card className="border border-red-200 bg-red-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Escalation Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {delayed.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg" data-testid={`delayed-project-${p.id}`}>
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="text-xs text-slate-600">{clientsById[p.clientId]?.name || '—'} · ended {p.projectEndDate}</p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => navigate(`/project/${p.id}`)}>View</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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

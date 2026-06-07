import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, CheckCircle, Briefcase, Building2, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Agencies, Projects, Clients as ClientsApi, Users, Pods } from '@/lib/api';

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [clientsById, setClientsById] = useState({});
  const [usersById, setUsersById] = useState({});
  const [podsById, setPodsById] = useState({});

  useEffect(() => { (async () => {
    try {
      const ags = await Agencies.list();
      const agency = ags[0];
      const aid = agency?.id;
      const [ps, cs, us, pds] = await Promise.all([
        Projects.list(aid ? { agencyId: aid } : undefined),
        ClientsApi.list(aid ? { agencyId: aid } : undefined),
        Users.list({ agencyId: aid }),
        Pods.list(aid),
      ]);
      setProjects(ps);
      setClientsById(Object.fromEntries(cs.map(c => [c.id, c])));
      setUsersById(Object.fromEntries(us.map(u => [u.id, u])));
      setPodsById(Object.fromEntries(pds.map(p => [p.id, p])));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  })(); }, []);

  const stats = useMemo(() => {
    const byStatus = (s) => projects.filter(p => p.statusCategory === s).length;
    const podCounts = {};
    for (const p of projects) {
      const k = p.podId || '__nopod__';
      podCounts[k] = (podCounts[k] || 0) + 1;
    }
    return {
      total: projects.length,
      active: byStatus('active'),
      onHold: byStatus('on_hold'),
      completed: byStatus('completed'),
      clients: Object.keys(clientsById).length,
      people: Object.keys(usersById).length,
      podCounts,
    };
  }, [projects, clientsById, usersById]);

  const kpis = [
    { title: 'Projects',  value: stats.total,     icon: Briefcase,   color: 'text-violet-600', bg: 'bg-violet-50' },
    { title: 'Active',    value: stats.active,    icon: TrendingUp,  color: 'text-blue-600',   bg: 'bg-blue-50' },
    { title: 'On hold',   value: stats.onHold,    icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50' },
    { title: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
  ];

  const podRows = Object.entries(stats.podCounts).map(([id, count]) => ({
    id, name: podsById[id]?.name || (id === '__nopod__' ? 'No Pod' : id), count,
  }));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome back, {user?.name}.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(k => {
              const Icon = k.icon;
              return (
                <Card key={k.title} className="border border-slate-200 shadow-sm" data-testid={`kpi-${k.title.toLowerCase()}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">{k.title}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">{k.value}</p>
                      </div>
                      <div className={`${k.bg} p-3 rounded-lg`}>
                        <Icon className={`w-6 h-6 ${k.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{stats.clients}</p>
                <p className="text-xs text-slate-500 mt-1">Active accounts</p>
                <button
                  className="mt-3 text-xs text-slate-700 hover:text-slate-900 underline"
                  onClick={() => navigate('/clients')}
                  data-testid="goto-clients"
                >
                  Manage clients →
                </button>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UsersIcon className="w-4 h-4" />People
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{stats.people}</p>
                <p className="text-xs text-slate-500 mt-1">Across all departments</p>
                {user?.role === 'project_manager' && (
                  <button
                    className="mt-3 text-xs text-slate-700 hover:text-slate-900 underline"
                    onClick={() => navigate('/team-directory')}
                  >
                    Team directory →
                  </button>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Pod load</CardTitle>
              </CardHeader>
              <CardContent>
                {podRows.length === 0 ? (
                  <p className="text-sm text-slate-500">No projects yet.</p>
                ) : (
                  <div className="space-y-2">
                    {podRows.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{r.name}</span>
                        <span className="font-mono text-slate-900">{r.count} project{r.count === 1 ? '' : 's'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No projects yet.</p>
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="w-full text-left flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      data-testid={`recent-project-${p.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {clientsById[p.clientId]?.name || '—'} · {podsById[p.podId]?.name || 'No Pod'}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500 shrink-0 ml-3">
                        <p className="font-mono">{p.projectStartDate || '—'} → {p.projectEndDate || '—'}</p>
                        <p className="capitalize">{(p.statusCategory || '').replace('_', ' ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

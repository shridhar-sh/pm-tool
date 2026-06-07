import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Agencies, Projects, Clients as ClientsApi, Pods, Users as UsersApi } from '@/lib/api';

const PROJECT_STATUS_STYLES = {
  active:    'bg-blue-50 text-blue-700 border-blue-200',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function MyDeck({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [clientsById, setClientsById] = useState({});
  const [podsById, setPodsById] = useState({});
  const [usersById, setUsersById] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [podFilter, setPodFilter] = useState('all');

  useEffect(() => { (async () => {
    try {
      const ags = await Agencies.list();
      const aid = ags[0]?.id;
      const [projs, clients, pods, users] = await Promise.all([
        Projects.list(aid ? { agencyId: aid } : undefined),
        ClientsApi.list(aid ? { agencyId: aid } : undefined),
        Pods.list(aid),
        UsersApi.list({ agencyId: aid }),
      ]);
      setProjects(projs);
      setClientsById(Object.fromEntries(clients.map(c => [c.id, c])));
      setPodsById(Object.fromEntries(pods.map(p => [p.id, p])));
      setUsersById(Object.fromEntries(users.map(u => [u.id, u])));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tracker');
    } finally {
      setLoading(false);
    }
  })(); }, []);

  const podOptions = useMemo(() => Object.values(podsById), [podsById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.statusCategory !== statusFilter) return false;
      if (podFilter !== 'all' && p.podId !== podFilter) return false;
      if (q) {
        const hay = `${p.name} ${clientsById[p.clientId]?.name || ''} ${p.sow || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projects, search, statusFilter, podFilter, clientsById]);

  const userLabel = (uid) => usersById[uid]?.shortName || usersById[uid]?.name || '—';

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">AM Tracker</h1>
        <p className="text-slate-600 mt-1">All projects across the agency</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by project, client, or SOW…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="tracker-search-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={podFilter} onValueChange={setPodFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pods</SelectItem>
              {podOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Projects ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No projects match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Project</th>
                    <th className="p-3 text-left">Client</th>
                    <th className="p-3 text-left">Pod</th>
                    <th className="p-3 text-left">PM / AM / LP</th>
                    <th className="p-3 text-left">Dates</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                      data-testid={`tracker-row-${p.id}`}
                    >
                      <td className="p-3 font-medium text-slate-900">
                        <div>{p.name}</div>
                        {p.sow && <div className="text-xs text-slate-500 truncate max-w-[26rem]">{p.sow}</div>}
                      </td>
                      <td className="p-3 text-slate-700">{clientsById[p.clientId]?.name || '—'}</td>
                      <td className="p-3 text-slate-700">{podsById[p.podId]?.name || '—'}</td>
                      <td className="p-3 text-xs text-slate-600">
                        <div>{userLabel(p.assignedPMUserId)}</div>
                        <div>{userLabel(p.assignedAMUserId)}</div>
                        <div>{userLabel(p.assignedLPUserId)}</div>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {p.projectStartDate || '—'} → {p.projectEndDate || '—'}
                      </td>
                      <td className="p-3">
                        <Badge className={`text-xs rounded-full border ${PROJECT_STATUS_STYLES[p.statusCategory] || PROJECT_STATUS_STYLES.active}`}>
                          {(p.statusCategory || 'active').replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

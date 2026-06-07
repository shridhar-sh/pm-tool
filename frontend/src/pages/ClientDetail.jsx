import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, FileText, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clients as ClientsApi, Projects } from '@/lib/api';

const STATUS_STYLES = {
  active:    'bg-green-50 text-green-700 border-green-200',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200',
  archived:  'bg-slate-100 text-slate-600 border-slate-200',
};

const PROJECT_STATUS_STYLES = {
  active:     'bg-blue-50 text-blue-700 border-blue-200',
  on_hold:    'bg-amber-50 text-amber-700 border-amber-200',
  completed:  'bg-green-50 text-green-700 border-green-200',
  cancelled:  'bg-slate-100 text-slate-600 border-slate-200',
};

export default function ClientDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, ps] = await Promise.all([
          ClientsApi.get(id),
          Projects.list({ clientId: id }),
        ]);
        setClient(c);
        setProjects(ps);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load client');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }
  if (!client) {
    return <div className="p-8 text-slate-500">Client not found.</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/clients')}
        className="text-slate-600 hover:text-slate-900"
        data-testid="back-to-clients"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Clients
      </Button>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-100 rounded-md flex items-center justify-center">
              <Building2 className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs rounded-full border ${STATUS_STYLES[client.status] || STATUS_STYLES.active}`}>
                  {client.status.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-slate-500 font-mono">{client.currency || 'INR'}</span>
                {client.gstin && <span className="text-xs text-slate-500 font-mono">GSTIN: {client.gstin}</span>}
              </div>
            </div>
          </div>
        </div>

        {client.notes && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-slate-700">{client.notes}</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border border-slate-200 shadow-sm md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {!client.contacts || client.contacts.length === 0 ? (
              <p className="text-sm text-slate-500">No contacts yet.</p>
            ) : (
              <div className="space-y-4">
                {client.contacts.map((c, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.role && <p className="text-xs text-slate-500">{c.role}</p>}
                    {c.email && (
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" />{c.email}
                      </p>
                    )}
                    {c.phone && (
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{c.phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Projects</CardTitle>
            <span className="text-xs text-slate-500">{projects.length} total</span>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No projects for this client yet.</p>
            ) : (
              <div className="space-y-3">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/project/${p.id}`)}
                    data-testid={`client-project-${p.id}`}
                    className="w-full text-left flex items-start justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{p.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        <FileText className="w-3 h-3 inline mr-1" />{p.sow || '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="font-mono">
                          {p.projectStartDate || '—'} → {p.projectEndDate || '—'}
                        </span>
                        {p.budgetINR > 0 && (
                          <span className="font-mono">₹{(p.budgetINR / 100000).toFixed(1)}L</span>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-xs rounded-full border ml-3 shrink-0 ${PROJECT_STATUS_STYLES[p.statusCategory] || PROJECT_STATUS_STYLES.active}`}>
                      {(p.statusCategory || 'active').replace('_', ' ')}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

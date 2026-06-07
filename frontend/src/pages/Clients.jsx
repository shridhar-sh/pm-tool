import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, Mail, Phone, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clients as ClientsApi, Agencies } from '@/lib/api';

const STATUS_STYLES = {
  active:    'bg-green-50 text-green-700 border-green-200',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200',
  archived:  'bg-slate-100 text-slate-600 border-slate-200',
};

export default function Clients({ user }) {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agencyId, setAgencyId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());

  function emptyDraft() {
    return {
      name: '', contactName: '', contactEmail: '', contactPhone: '', contactRole: '',
      gstin: '', currency: 'INR', status: 'active', notes: '',
    };
  }

  useEffect(() => {
    (async () => {
      try {
        const agencies = await Agencies.list();
        const agency = agencies[0];
        setAgencyId(agency?.id || null);
        const list = await ClientsApi.list(agency ? { agencyId: agency.id } : undefined);
        setClients(list);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load clients');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  const canCreate = user?.role === 'project_manager' || user?.role === 'account_manager';

  async function handleCreate() {
    if (!draft.name.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (!agencyId) {
      toast.error('No agency found — run /api/admin/seed first');
      return;
    }
    try {
      const body = {
        agencyId,
        name: draft.name.trim(),
        contacts: draft.contactName ? [{
          name: draft.contactName,
          email: draft.contactEmail || null,
          phone: draft.contactPhone || null,
          role: draft.contactRole || null,
        }] : [],
        gstin: draft.gstin || null,
        currency: draft.currency,
        status: draft.status,
        notes: draft.notes || null,
      };
      const created = await ClientsApi.create(body);
      setClients(prev => [...prev, created]);
      toast.success(`${created.name} added`);
      setDialogOpen(false);
      setDraft(emptyDraft());
    } catch (e) {
      console.error(e);
      toast.error('Failed to create client');
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-600 mt-1">All agency clients and their accounts</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800" data-testid="new-client-button">
                <Plus className="w-4 h-4 mr-2" />
                New Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Client</DialogTitle>
                <DialogDescription>Create a new client account</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <Field label="Client name *">
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Nike India"
                    data-testid="client-name-input"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status">
                    <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_hold">On hold</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="GSTIN">
                    <Input
                      value={draft.gstin}
                      onChange={(e) => setDraft({ ...draft, gstin: e.target.value })}
                      placeholder="29ABCDE1234F1Z5"
                    />
                  </Field>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-3">Primary contact (optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name">
                      <Input
                        value={draft.contactName}
                        onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                        placeholder="Aarav Sharma"
                      />
                    </Field>
                    <Field label="Role">
                      <Input
                        value={draft.contactRole}
                        onChange={(e) => setDraft({ ...draft, contactRole: e.target.value })}
                        placeholder="Brand Manager"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={draft.contactEmail}
                        onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                        placeholder="aarav@nike.example"
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={draft.contactPhone}
                        onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                        placeholder="+91-90000-11111"
                      />
                    </Field>
                  </div>
                </div>
                <Field label="Notes">
                  <Textarea
                    rows={3}
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    placeholder="Retainer client, always-on socials…"
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} className="bg-slate-900 hover:bg-slate-800" data-testid="save-client-button">
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="client-search-input"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-500">
            {clients.length === 0 ? 'No clients yet.' : 'No matches.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/clients/${c.id}`)}
              data-testid={`client-card-${c.id}`}
              className="text-left bg-white border border-slate-200 rounded-lg shadow-sm p-5 hover:border-slate-400 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-700" />
                </div>
                <Badge className={`text-xs rounded-full border ${STATUS_STYLES[c.status] || STATUS_STYLES.active}`}>
                  {c.status.replace('_', ' ')}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{c.name}</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">{c.currency || 'INR'}</p>
              {c.contacts?.[0] && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                  <p className="text-sm font-medium text-slate-700">{c.contacts[0].name}</p>
                  {c.contacts[0].email && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />{c.contacts[0].email}
                    </p>
                  )}
                  {c.contacts[0].phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{c.contacts[0].phone}
                    </p>
                  )}
                </div>
              )}
              {c.notes && (
                <p className="text-xs text-slate-500 mt-3 line-clamp-2">
                  <Briefcase className="w-3 h-3 inline mr-1" />{c.notes}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

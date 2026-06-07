import { useState, useEffect, useMemo } from 'react';
import { Plus, Users as UsersIcon, Trash2, ChevronDown, ChevronRight, Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Agencies, Departments, Pods, Users } from '@/lib/api';

const ROLES = [
  'project_manager', 'account_manager', 'line_producer', 'team_member',
  'strategist', 'pre_production', 'production', 'editor',
];

export default function TeamDirectory({ user }) {
  const [agencyId, setAgencyId] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [pods, setPods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});  // dept id -> bool
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  function emptyDraft() {
    return { employeeId: '', name: '', shortName: '', email: '', role: 'team_member',
             departmentId: '', podId: '', capacityHrsPerWeek: 40, billRateINR: 0 };
  }

  useEffect(() => { (async () => { await loadAll(); })(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const ags = await Agencies.list();
      const agency = ags[0];
      const aid = agency?.id;
      setAgencyId(aid);
      const [d, p, u] = await Promise.all([
        Departments.list(aid),
        Pods.list(aid),
        Users.list({ agencyId: aid }),
      ]);
      setDepartments(d);
      setPods(p);
      setUsers(u);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load directory');
    } finally {
      setLoading(false);
    }
  }

  const tree = useMemo(() => {
    const podsByDept = {};
    for (const p of pods) {
      const k = p.departmentId || '__none__';
      (podsByDept[k] = podsByDept[k] || []).push(p);
    }
    const usersByPod = {};
    const usersByDeptNoPod = {};
    const orphans = [];
    for (const u of users) {
      if (u.podId) {
        (usersByPod[u.podId] = usersByPod[u.podId] || []).push(u);
      } else if (u.departmentId) {
        (usersByDeptNoPod[u.departmentId] = usersByDeptNoPod[u.departmentId] || []).push(u);
      } else {
        orphans.push(u);
      }
    }
    return { podsByDept, usersByPod, usersByDeptNoPod, orphans };
  }, [pods, users]);

  const canEdit = user?.role === 'project_manager';

  async function createUser() {
    if (!draft.name || !draft.employeeId) return toast.error('Employee ID and Name are required');
    if (!agencyId) return toast.error('No agency found');
    try {
      const dept = departments.find(d => d.id === draft.departmentId);
      await Users.create({
        agencyId,
        employeeId: draft.employeeId.trim(),
        name: draft.name.trim(),
        shortName: draft.shortName || null,
        email: draft.email || null,
        role: draft.role,
        departmentId: draft.departmentId || null,
        podId: draft.podId || null,
        capacityHrsPerWeek: Number(draft.capacityHrsPerWeek) || 40,
        billRateINR: Number(draft.billRateINR) || 0,
        active: true,
      });
      toast.success(`${draft.name} added`);
      setDialogOpen(false);
      setDraft(emptyDraft());
      loadAll();
    } catch (e) { console.error(e); toast.error('Failed to add user'); }
  }

  async function deleteUser(u) {
    if (!window.confirm(`Remove ${u.name}?`)) return;
    try {
      await Users.delete(u.id);
      toast.success('Removed');
      loadAll();
    } catch (e) { console.error(e); toast.error('Failed to remove'); }
  }

  function initials(name) {
    return (name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  }

  function toggleDept(id) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Team Directory</h1>
          <p className="text-slate-600 mt-1">Departments → Pods → People</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800" data-testid="add-user-button">
                <Plus className="w-4 h-4 mr-2" />Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Employee</DialogTitle>
                <DialogDescription>New team member</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Employee ID *"><Input value={draft.employeeId} onChange={e => setDraft({ ...draft, employeeId: e.target.value })} placeholder="AGY-011" /></Field>
                  <Field label="Email"><Input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="name@agency.com" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full Name *"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Jane Doe" /></Field>
                  <Field label="Short Name"><Input value={draft.shortName} onChange={e => setDraft({ ...draft, shortName: e.target.value })} placeholder="Jane" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role">
                    <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Department">
                    <Select value={draft.departmentId} onValueChange={(v) => setDraft({ ...draft, departmentId: v, podId: '' })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Pod">
                    <Select value={draft.podId} onValueChange={(v) => setDraft({ ...draft, podId: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {pods.filter(p => !draft.departmentId || p.departmentId === draft.departmentId)
                             .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Capacity (hrs/wk)"><Input type="number" min="0" value={draft.capacityHrsPerWeek} onChange={e => setDraft({ ...draft, capacityHrsPerWeek: e.target.value })} /></Field>
                  <Field label="Bill rate (₹/hr)"><Input type="number" min="0" value={draft.billRateINR} onChange={e => setDraft({ ...draft, billRateINR: e.target.value })} /></Field>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createUser} className="bg-slate-900 hover:bg-slate-800" data-testid="save-user-button">Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-4">
          {departments.map(d => {
            const deptPods = tree.podsByDept[d.id] || [];
            const noPodUsers = tree.usersByDeptNoPod[d.id] || [];
            const isCollapsed = collapsed[d.id];
            const totalInDept = noPodUsers.length + deptPods.reduce((acc, p) => acc + (tree.usersByPod[p.id]?.length || 0), 0);
            return (
              <Card key={d.id} className="border border-slate-200 shadow-sm" data-testid={`dept-${d.id}`}>
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => toggleDept(d.id)}>
                  <CardTitle className="text-base flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                    {d.name}
                    <span className="text-xs font-normal text-slate-500">{totalInDept} {totalInDept === 1 ? 'person' : 'people'}</span>
                  </CardTitle>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="space-y-4">
                    {deptPods.map(p => (
                      <PodBlock key={p.id} pod={p} members={tree.usersByPod[p.id] || []} initials={initials} canEdit={canEdit} onDelete={deleteUser} />
                    ))}
                    {noPodUsers.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 ml-6">No pod</p>
                        <UserGrid members={noPodUsers} initials={initials} canEdit={canEdit} onDelete={deleteUser} />
                      </div>
                    )}
                    {totalInDept === 0 && <p className="text-xs text-slate-500 ml-6">No one in this department yet.</p>}
                  </CardContent>
                )}
              </Card>
            );
          })}
          {tree.orphans.length > 0 && (
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Unassigned (no department)</CardTitle>
              </CardHeader>
              <CardContent>
                <UserGrid members={tree.orphans} initials={initials} canEdit={canEdit} onDelete={deleteUser} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PodBlock({ pod, members, initials, canEdit, onDelete }) {
  return (
    <div className="border border-slate-100 rounded-md p-3 bg-slate-50/50">
      <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
        <Building className="w-3 h-3" />{pod.name}
        <span className="text-slate-500 font-normal">({members.length})</span>
      </p>
      {members.length === 0 ? (
        <p className="text-xs text-slate-500">Empty pod.</p>
      ) : (
        <UserGrid members={members} initials={initials} canEdit={canEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

function UserGrid({ members, initials, canEdit, onDelete }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {members.map(u => (
        <div key={u.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-md p-2.5" data-testid={`user-${u.id}`}>
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="bg-slate-900 text-white text-xs">{initials(u.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
            <p className="text-xs text-slate-500 truncate">{u.role.replace('_', ' ')} · {u.employeeId}</p>
          </div>
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => onDelete(u)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
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

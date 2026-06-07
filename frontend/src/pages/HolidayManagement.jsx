import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Trash2, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { format, parseISO, getDay } from 'date-fns';
import { toast } from 'sonner';
import { Agencies, Holidays } from '@/lib/api';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HolidayManagement({ user }) {
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const [agencyId, setAgencyId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ date: '', name: '' });

  useEffect(() => { (async () => { await loadAll(); })(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const ags = await Agencies.list();
      const aid = ags[0]?.id;
      setAgencyId(aid);
      const list = await Holidays.list(aid);
      list.sort((a, b) => a.date.localeCompare(b.date));
      setHolidays(list);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }

  const dayOfWeek = (dateStr) => DOW[getDay(parseISO(dateStr))];

  async function addHoliday() {
    if (!draft.date || !draft.name) return toast.error('Date and name are required');
    try {
      await Holidays.create({ agencyId, date: draft.date, name: draft.name, dayOfWeek: dayOfWeek(draft.date) });
      toast.success(`${draft.name} added`);
      setAddOpen(false);
      setDraft({ date: '', name: '' });
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to add holiday');
    }
  }

  async function saveEdit() {
    if (!editing?.date || !editing?.name) return toast.error('Date and name are required');
    try {
      await Holidays.update(editing.id, { date: editing.date, name: editing.name, dayOfWeek: dayOfWeek(editing.date) });
      toast.success('Updated');
      setEditOpen(false);
      setEditing(null);
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update');
    }
  }

  async function removeHoliday(h) {
    if (!window.confirm(`Delete "${h.name}"?`)) return;
    try {
      await Holidays.delete(h.id);
      toast.success('Deleted');
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete');
    }
  }

  async function toggleWorking(h) {
    try {
      await Holidays.update(h.id, { isWorking: !h.isWorking });
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to toggle');
    }
  }

  async function reseed() {
    if (!window.confirm('Replace all holidays with the 2026 seed list?')) return;
    try {
      await Holidays.seed(agencyId);
      toast.success('Holidays re-seeded');
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Re-seed failed');
    }
  }

  const grouped = useMemo(() => {
    const m = {};
    for (const h of holidays) {
      const month = format(parseISO(h.date), 'MMMM yyyy');
      (m[month] = m[month] || []).push(h);
    }
    return m;
  }, [holidays]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Holiday Management</h1>
          <p className="text-slate-600 mt-1">Indian 2026 holidays + custom overrides</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reseed} data-testid="reseed-holidays-btn">
            <RefreshCw className="w-4 h-4 mr-2" />Re-seed 2026
          </Button>
          <Button onClick={() => setAddOpen(true)} className="bg-slate-900 hover:bg-slate-800" data-testid="add-holiday-btn">
            <Plus className="w-4 h-4 mr-2" />Add Holiday
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total Holidays" value={holidays.length} icon={Calendar} color="red" />
        <Stat label="Marked Working" value={holidays.filter(h => h.isWorking).length} icon={Check} color="green" />
        <Stat label="Non-Working" value={holidays.filter(h => !h.isWorking).length} icon={X} color="amber" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading…</div>
      ) : holidays.length === 0 ? (
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-500">
            No holidays. Click "Re-seed 2026" to load the Indian holiday calendar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, list]) => (
            <Card key={month} className="border border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-800 text-white py-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />{month} ({list.length} {list.length === 1 ? 'holiday' : 'holidays'})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="p-3 text-left w-32">Date</th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-center w-24">Day</th>
                      <th className="p-3 text-center w-32">Working?</th>
                      <th className="p-3 text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((h, idx) => (
                      <tr key={h.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-3 font-mono text-xs">{format(parseISO(h.date), 'MMM dd, yyyy')}</td>
                        <td className="p-3 font-semibold">{h.name}</td>
                        <td className="p-3 text-center">
                          <Badge className={`text-xs rounded-full border ${
                            (h.dayOfWeek === 'Sat' || h.dayOfWeek === 'Sun')
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {h.dayOfWeek}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch checked={h.isWorking} onCheckedChange={() => toggleWorking(h)} />
                            <span className={`text-xs ${h.isWorking ? 'text-green-600' : 'text-red-600'}`}>
                              {h.isWorking ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setEditing(h); setEditOpen(true); }}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => removeHoliday(h)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>Add a company holiday</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} data-testid="holiday-date-input" />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Diwali" data-testid="holiday-name-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addHoliday} className="bg-slate-900 hover:bg-slate-800" data-testid="submit-holiday-btn">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Holiday</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-slate-900 hover:bg-slate-800">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STAT_COLOR = {
  red:   { bg: 'bg-red-100',   text: 'text-red-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
};

function Stat({ label, value, icon: Icon, color }) {
  const c = STAT_COLOR[color] || STAT_COLOR.red;
  return (
    <Card className="border border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-600">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

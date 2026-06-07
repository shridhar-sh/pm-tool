import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Projects, Clients as ClientsApi, Tasks, Users as UsersApi, TimeEntries, Agencies,
} from '@/lib/api';

/**
 * Print-friendly INR invoice for one project.
 *
 *   /invoice/:projectId
 *
 * Reads all billable time entries (filterable by date range), groups by task
 * (default) or by user, applies GST (IGST or split CGST+SGST), and prints
 * cleanly via the browser's Print dialog.
 */
export default function Invoice() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [agency, setAgency] = useState(null);
  const [project, setProject] = useState(null);
  const [client, setClient] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('task');     // 'task' | 'user'
  const [gstMode, setGstMode] = useState('igst');     // 'igst' | 'split' | 'none'
  const [gstPct, setGstPct] = useState(18);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [invoiceNo, setInvoiceNo] = useState(() => `INV-${format(new Date(), 'yyyyMM')}-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [invoiceDate, setInvoiceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 14), 'yyyy-MM-dd'));

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const [ags, p] = await Promise.all([Agencies.list(), Projects.get(projectId)]);
      setAgency(ags[0] || null);
      setProject(p);
      const [c, us, ts] = await Promise.all([
        ClientsApi.get(p.clientId).catch(() => null),
        UsersApi.list({ agencyId: p.agencyId }),
        Tasks.forProject(projectId),
      ]);
      setClient(c);
      setUsers(us);
      setTasks(ts);
      setFrom(p.projectStartDate || '');
      setTo(p.projectEndDate || '');
    } catch (e) {
      console.error(e);
      toast.error('Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  })(); }, [projectId]);

  useEffect(() => { (async () => {
    if (!project) return;
    try {
      const params = { projectId, billable: true };
      if (from) params.fromDate = from;
      if (to)   params.toDate = to;
      setEntries(await TimeEntries.list(params));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load time entries');
    }
  })(); }, [project, from, to, projectId]);

  const usersById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);
  const tasksById = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);

  const lineItems = useMemo(() => {
    const buckets = {};
    for (const e of entries) {
      const key = groupBy === 'user' ? e.userId : (e.taskId || '__no_task__');
      const label = groupBy === 'user'
        ? (usersById[e.userId]?.name || 'Unknown')
        : (tasksById[e.taskId]?.name || 'Unallocated');
      const item = buckets[key] || {
        key, label, hours: 0, amount: 0, rateSum: 0, rateCount: 0,
      };
      item.hours += e.hours;
      item.amount += e.hours * e.billRateINRSnapshot;
      item.rateSum += e.billRateINRSnapshot;
      item.rateCount += 1;
      buckets[key] = item;
    }
    return Object.values(buckets)
      .map(it => ({
        ...it,
        hours: Math.round(it.hours * 100) / 100,
        amount: Math.round(it.amount),
        rate: it.rateCount ? Math.round(it.rateSum / it.rateCount) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [entries, groupBy, usersById, tasksById]);

  const subtotal = useMemo(() => lineItems.reduce((a, b) => a + b.amount, 0), [lineItems]);
  const taxAmount = useMemo(() => gstMode === 'none' ? 0 : Math.round(subtotal * gstPct / 100), [subtotal, gstPct, gstMode]);
  const cgst = gstMode === 'split' ? Math.round(taxAmount / 2) : 0;
  const sgst = gstMode === 'split' ? (taxAmount - cgst) : 0;
  const igst = gstMode === 'igst' ? taxAmount : 0;
  const total = subtotal + taxAmount;

  if (loading) {
    return <div className="p-8 text-slate-500">Loading invoice…</div>;
  }
  if (!project) {
    return <div className="p-8 text-slate-500">Project not found.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <PrintStyles />

      {/* Toolbar — hidden when printing */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-end gap-3">
        <Button variant="ghost" onClick={() => navigate(`/project/${projectId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to project
        </Button>
        <div className="flex-1" />
        <ToolField label="Group by">
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </ToolField>
        <ToolField label="GST">
          <Select value={gstMode} onValueChange={setGstMode}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="igst">IGST</SelectItem>
              <SelectItem value="split">CGST+SGST</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </ToolField>
        <ToolField label="Rate %">
          <Input type="number" min="0" max="50" step="0.5" value={gstPct} onChange={e => setGstPct(Number(e.target.value) || 0)} className="w-[80px]" />
        </ToolField>
        <ToolField label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></ToolField>
        <ToolField label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></ToolField>
        <Button onClick={() => window.print()} className="bg-slate-900 hover:bg-slate-800">
          <Printer className="w-4 h-4 mr-2" />Print / Save PDF
        </Button>
      </div>

      {/* Invoice — visible on screen + paper */}
      <div className="print-page max-w-[900px] mx-auto my-8 bg-white border border-slate-200 shadow-sm">
        <div className="px-12 py-10 space-y-8">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-6 border-b-2 border-slate-900">
            <div>
              <p className="text-2xl font-bold text-slate-900">{agency?.name || 'AgencyPM'}</p>
              <p className="text-xs text-slate-500 mt-1">Bengaluru, IN · {agency?.timezone || 'Asia/Kolkata'}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-slate-900 uppercase tracking-wide">Invoice</p>
              <p className="text-sm text-slate-700 mt-1 font-mono">{invoiceNo}</p>
            </div>
          </div>

          {/* Bill-to + meta */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Bill to</p>
              <p className="font-semibold text-slate-900">{client?.name || '—'}</p>
              {client?.gstin && <p className="text-xs font-mono text-slate-600 mt-1">GSTIN {client.gstin}</p>}
              {client?.contacts?.[0]?.email && <p className="text-xs text-slate-600 mt-1">{client.contacts[0].email}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <KV label="Project"      value={project.name} />
              <KV label="Currency"     value={project.currency || 'INR'} />
              <KV label="Invoice date" value={invoiceDate} editable onChange={setInvoiceDate} />
              <KV label="Due date"     value={dueDate} editable onChange={setDueDate} />
              {from && <KV label="Period from" value={from} />}
              {to && <KV label="Period to"   value={to} />}
            </div>
          </div>

          {/* Line items */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 text-[10px] uppercase tracking-wide text-slate-600">
                  <th className="text-left  py-2">{groupBy === 'user' ? 'User' : 'Task'}</th>
                  <th className="text-right py-2 w-24">Hours</th>
                  <th className="text-right py-2 w-28">₹ / hr</th>
                  <th className="text-right py-2 w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-500">No billable time in this window.</td></tr>
                ) : lineItems.map(it => (
                  <tr key={it.key} className="border-b border-slate-100">
                    <td className="py-3">{it.label}</td>
                    <td className="py-3 text-right font-mono">{it.hours.toFixed(2)}</td>
                    <td className="py-3 text-right font-mono text-slate-600">{it.rate.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right font-mono">₹{it.amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <Line label="Subtotal" value={subtotal} bold />
              {gstMode === 'igst' && <Line label={`IGST ${gstPct}%`} value={igst} />}
              {gstMode === 'split' && (
                <>
                  <Line label={`CGST ${gstPct / 2}%`} value={cgst} />
                  <Line label={`SGST ${gstPct / 2}%`} value={sgst} />
                </>
              )}
              <div className="border-t border-slate-300 mt-2 pt-2">
                <Line label="Total payable" value={total} bold big />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <p>Payable in INR within {Math.max(0, Math.round((new Date(dueDate) - new Date(invoiceDate)) / (1000 * 60 * 60 * 24)))} days of invoice date.</p>
            <p>Computer-generated invoice. No signature required.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

function KV({ label, value, editable, onChange }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      {editable ? (
        <Input value={value} onChange={(e) => onChange?.(e.target.value)} className="h-7 text-sm mt-0.5 no-print-border" />
      ) : (
        <p className="text-sm font-medium text-slate-900">{value}</p>
      )}
    </div>
  );
}

function Line({ label, value, bold, big }) {
  return (
    <div className={`flex justify-between ${big ? 'text-lg' : ''}`}>
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</span>
      <span className={`font-mono ${bold ? 'font-semibold' : ''} text-slate-900`}>
        ₹{Math.round(value).toLocaleString('en-IN')}
      </span>
    </div>
  );
}

function ToolField({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        body, .min-h-screen { background: white !important; }
        .print-page { box-shadow: none !important; border: none !important; margin: 0 auto !important; max-width: 100% !important; }
        @page { margin: 14mm; }
      }
      .no-print-border > input,
      input.no-print-border {
        border: 1px solid #e2e8f0;
      }
    `}</style>
  );
}

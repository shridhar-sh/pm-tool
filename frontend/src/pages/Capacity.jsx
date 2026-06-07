import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Filter, AlertTriangle } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Agencies, Pods, Capacity as CapacityApi } from '@/lib/api';

const ROLE_OPTIONS = [
  'project_manager', 'account_manager', 'line_producer', 'team_member',
  'strategist', 'pre_production', 'production', 'editor',
];

export default function Capacity({ user }) {
  const navigate = useNavigate();
  const [agencyId, setAgencyId] = useState(null);
  const [pods, setPods] = useState([]);
  const [from, setFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(addDays(new Date(), 8 * 7 - 1), 'yyyy-MM-dd'));
  const [podId, setPodId] = useState('all');
  const [role, setRole] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => { (async () => {
    try {
      const ags = await Agencies.list();
      const aid = ags[0]?.id;
      setAgencyId(aid);
      setPods(await Pods.list(aid));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load agency context');
    }
  })(); }, []);

  useEffect(() => { (async () => {
    if (!agencyId) return;
    setLoading(true);
    setErr(null);
    try {
      const params = { agencyId, from, to };
      if (podId !== 'all') params.podId = podId;
      if (role !== 'all') params.role = role;
      setData(await CapacityApi.get(params));
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.detail || 'Failed to load capacity');
    } finally {
      setLoading(false);
    }
  })(); }, [agencyId, from, to, podId, role]);

  const stats = useMemo(() => {
    if (!data) return null;
    const overbookedUsers = data.rows.filter(r => r.overbookedWeeks > 0).length;
    const activeUsers = data.rows.filter(r => r.peakHours > 0).length;
    const idleUsers = data.rows.length - activeUsers;
    return { overbookedUsers, activeUsers, idleUsers };
  }, [data]);

  const podsById = useMemo(() => Object.fromEntries(pods.map(p => [p.id, p])), [pods]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Capacity</h1>
          <p className="text-slate-600 mt-1">Weekly load vs capacity per person · open tasks only</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Overbooked"  value={stats.overbookedUsers} icon={AlertTriangle} color="red" />
          <Kpi label="Active"      value={stats.activeUsers}     icon={Activity}     color="amber" />
          <Kpi label="Idle"        value={stats.idleUsers}       icon={Activity}     color="green" />
          <Kpi label="Weeks shown" value={data?.weekStarts?.length || 0} icon={Activity} color="blue" />
        </div>
      )}

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex flex-wrap gap-3 items-end">
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="capacity-from-input" /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="capacity-to-input" /></Field>
            <Field label="Pod">
              <Select value={podId} onValueChange={setPodId}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pods</SelectItem>
                  {pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Legend />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Computing…</div>
          ) : err ? (
            <div className="text-center py-12 text-red-700">{err}</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No people match these filters.</div>
          ) : (
            <Heatmap data={data} podsById={podsById} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Heatmap({ data, podsById }) {
  const { rows, weekStarts } = data;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-600 uppercase tracking-wide">
            <th className="sticky left-0 z-10 bg-slate-50 text-left p-3 w-56">Person</th>
            <th className="text-left p-3 w-16">Cap</th>
            <th className="text-left p-3 w-20">Peak</th>
            {weekStarts.map(ws => (
              <th key={ws} className="p-2 text-center min-w-[64px]">
                <div>{format(parseISO(ws), 'MMM d')}</div>
                <div className="font-mono text-[10px] text-slate-400">{format(parseISO(ws), 'EEEEEE')}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.userId} className="border-t border-slate-100">
              <td className="sticky left-0 z-10 bg-white p-3">
                <div className="font-medium text-slate-900 truncate">{r.shortName || r.name}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {r.role?.replace('_', ' ')}{r.podId && podsById[r.podId] ? ` · ${podsById[r.podId].name}` : ''}
                </div>
              </td>
              <td className="p-3 font-mono text-slate-600">{r.capacityHrsPerWeek}h</td>
              <td className="p-3">
                <Badge className={`text-xs rounded-full border ${ratioStyle(r.peakRatio).cell}`}>
                  {r.peakHours}h · {Math.round(r.peakRatio * 100)}%
                </Badge>
              </td>
              {r.loadByWeek.map((h, i) => {
                const ratio = r.capacityHrsPerWeek ? h / r.capacityHrsPerWeek : 0;
                const st = ratioStyle(ratio);
                return (
                  <td
                    key={i}
                    className={`p-2 text-center font-mono ${st.cell} border border-white`}
                    title={`${h}h / ${r.capacityHrsPerWeek}h (${Math.round(ratio * 100)}%) · week of ${weekStarts[i]}`}
                  >
                    {h > 0 ? h : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Map a load/capacity ratio to a Tailwind colour scheme.
 * 0%       → slate (idle)
 * <50%     → green
 * 50-90%   → amber
 * 90-100%  → orange
 * >100%    → red
 */
function ratioStyle(ratio) {
  if (!ratio || ratio <= 0)   return { cell: 'bg-slate-50 text-slate-400' };
  if (ratio < 0.5)            return { cell: 'bg-green-100 text-green-800' };
  if (ratio < 0.9)            return { cell: 'bg-amber-100 text-amber-800' };
  if (ratio < 1.0)            return { cell: 'bg-orange-200 text-orange-900' };
  return                           { cell: 'bg-red-200 text-red-900 font-semibold' };
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
      <Swatch className="bg-slate-50"    label="Idle" />
      <Swatch className="bg-green-100"   label="<50%" />
      <Swatch className="bg-amber-100"   label="50-90%" />
      <Swatch className="bg-orange-200"  label="90-100%" />
      <Swatch className="bg-red-200"     label=">100%" />
    </div>
  );
}

function Swatch({ className, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-4 h-4 rounded-sm inline-block border border-slate-200 ${className}`} />
      {label}
    </span>
  );
}

const KPI_COLOR = {
  red:    { bg: 'bg-red-50',    text: 'text-red-600' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
};

function Kpi({ label, value, icon: Icon, color }) {
  const c = KPI_COLOR[color] || KPI_COLOR.amber;
  return (
    <Card className="border border-slate-200 shadow-sm">
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

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wide text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

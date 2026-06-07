import { useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * SVG Gantt chart driven by /api/projects/{id}/schedule.
 *
 *   <Gantt schedule={...} departmentsById={{...}} />
 *
 * Renders a day grid (1 day = `dayWidth` px) with:
 *   - month + day headers (sticky)
 *   - left-side phase + task labels (sticky)
 *   - one bar per phase (faded background row span)
 *   - one bar per task (department-colored; critical path = red border)
 *   - vertical stripes for weekends and non-working holidays
 *   - a "Today" vertical line
 *   - hover tooltip with dates, duration, working days
 */

const DEPT_FILL_BY_SLUG = {
  strategy:        '#a78bfa',  // violet-400
  pre_production:  '#38bdf8',  // sky-400
  production:      '#fbbf24',  // amber-400
  post_production: '#34d399',  // emerald-400
};
const FALLBACK_PALETTE = ['#94a3b8', '#fcd34d', '#fb7185', '#60a5fa', '#a78bfa'];

const TASK_ROW_H = 28;
const PHASE_HEADER_H = 36;
const HEADER_H = 56;
const LEFT_W = 240;

export default function Gantt({ schedule, departmentsById = {}, dayWidth = 24 }) {
  const [hover, setHover] = useState(null);

  const meta = useMemo(() => {
    if (!schedule?.projectStart || !schedule?.projectEnd) return null;
    const start = parseISO(schedule.projectStart);
    const end = parseISO(schedule.projectEnd);
    const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const dayList = Array.from({ length: totalDays }, (_, i) => addDays(start, i));
    // Group day columns by month for the upper header band.
    const months = [];
    let cur = null;
    dayList.forEach((d, i) => {
      const key = format(d, 'yyyy-MM');
      if (!cur || cur.key !== key) {
        cur = { key, label: format(d, 'MMM yyyy'), startIdx: i, length: 1 };
        months.push(cur);
      } else {
        cur.length += 1;
      }
    });
    const holidayByDate = Object.fromEntries(
      (schedule.holidays || []).map(h => [h.date, h])
    );
    return { start, end, totalDays, dayList, months, holidayByDate };
  }, [schedule]);

  const rows = useMemo(() => {
    if (!schedule) return [];
    const taskById = Object.fromEntries((schedule.tasks || []).map(t => [t.id, t]));
    const out = [];
    for (const ph of schedule.phases || []) {
      out.push({ kind: 'phase', data: ph });
      for (const tid of ph.taskIds || []) {
        const t = taskById[tid];
        if (t) out.push({ kind: 'task', data: t, phase: ph });
      }
    }
    // Append any orphan tasks (no phase or unknown phase).
    const placed = new Set(out.filter(r => r.kind === 'task').map(r => r.data.id));
    for (const t of schedule.tasks || []) {
      if (!placed.has(t.id)) out.push({ kind: 'task', data: t, phase: null });
    }
    return out;
  }, [schedule]);

  if (!meta) {
    return <div className="text-sm text-slate-500 p-4">No timeline data.</div>;
  }

  const bodyHeight = rows.reduce(
    (acc, r) => acc + (r.kind === 'phase' ? PHASE_HEADER_H : TASK_ROW_H),
    0
  );
  const gridWidth = meta.totalDays * dayWidth;

  function xFor(dateStr) {
    if (!dateStr) return 0;
    const d = parseISO(dateStr);
    return Math.max(0, differenceInCalendarDays(d, meta.start)) * dayWidth;
  }
  function widthFor(startStr, endStr) {
    const xs = xFor(startStr);
    const xe = xFor(endStr);
    // +1 day so a 1-day task is one full column.
    return Math.max(dayWidth, xe - xs + dayWidth);
  }

  function deptColor(departmentId) {
    const d = departmentsById[departmentId];
    if (d?.slug && DEPT_FILL_BY_SLUG[d.slug]) return DEPT_FILL_BY_SLUG[d.slug];
    if (d?.color) return d.color;
    return FALLBACK_PALETTE[0];
  }

  let cursorY = 0;
  const rowOffsets = rows.map(r => {
    const y = cursorY;
    cursorY += r.kind === 'phase' ? PHASE_HEADER_H : TASK_ROW_H;
    return y;
  });

  const todayX = (() => {
    const today = new Date();
    const idx = differenceInCalendarDays(today, meta.start);
    if (idx < 0 || idx > meta.totalDays) return null;
    return idx * dayWidth;
  })();

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* legend */}
      {(schedule.warnings || []).length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-800">
          {schedule.warnings.join(' · ')}
        </div>
      )}

      <div className="flex">
        {/* Sticky left labels */}
        <div className="shrink-0 border-r border-slate-200" style={{ width: LEFT_W }}>
          <div
            className="border-b border-slate-200 bg-slate-50 flex items-end px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide"
            style={{ height: HEADER_H }}
          >
            Phase / Task
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className={
                r.kind === 'phase'
                  ? 'flex items-center bg-slate-50 border-b border-slate-200 px-3 text-sm font-semibold text-slate-900'
                  : 'flex items-center border-b border-slate-100 pl-6 pr-3 text-xs text-slate-700'
              }
              style={{ height: r.kind === 'phase' ? PHASE_HEADER_H : TASK_ROW_H }}
              title={r.data.name}
            >
              <span className="truncate">{r.data.name}</span>
            </div>
          ))}
        </div>

        {/* Right scrollable grid */}
        <div className="flex-1 overflow-x-auto relative">
          <svg
            width={gridWidth}
            height={HEADER_H + bodyHeight}
            className="block"
            style={{ minWidth: gridWidth }}
          >
            {/* === header band === */}
            <g>
              {/* month band */}
              {meta.months.map((m, i) => (
                <g key={`m-${i}`}>
                  <rect
                    x={m.startIdx * dayWidth}
                    y={0}
                    width={m.length * dayWidth}
                    height={HEADER_H / 2}
                    fill="#f8fafc"
                    stroke="#e2e8f0"
                  />
                  <text
                    x={m.startIdx * dayWidth + 8}
                    y={HEADER_H / 2 - 8}
                    fontSize={11}
                    fill="#475569"
                    fontWeight={600}
                  >
                    {m.label}
                  </text>
                </g>
              ))}
              {/* day numbers */}
              {meta.dayList.map((d, i) => {
                const dow = d.getDay();
                const iso = format(d, 'yyyy-MM-dd');
                const hol = meta.holidayByDate[iso];
                const isOff = (dow === 0 || dow === 6 || (hol && !hol.isWorking));
                return (
                  <g key={`d-${i}`}>
                    <rect
                      x={i * dayWidth}
                      y={HEADER_H / 2}
                      width={dayWidth}
                      height={HEADER_H / 2}
                      fill={isOff ? '#f1f5f9' : '#ffffff'}
                      stroke="#e2e8f0"
                    />
                    <text
                      x={i * dayWidth + dayWidth / 2}
                      y={HEADER_H - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fill={isOff ? '#94a3b8' : '#475569'}
                    >
                      {format(d, 'd')}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* === body === */}
            <g transform={`translate(0, ${HEADER_H})`}>
              {/* off-day stripes (weekends + non-working holidays) */}
              {meta.dayList.map((d, i) => {
                const dow = d.getDay();
                const iso = format(d, 'yyyy-MM-dd');
                const hol = meta.holidayByDate[iso];
                const isOff = (dow === 0 || dow === 6 || (hol && !hol.isWorking));
                if (!isOff) return null;
                return (
                  <rect
                    key={`off-${i}`}
                    x={i * dayWidth}
                    y={0}
                    width={dayWidth}
                    height={bodyHeight}
                    fill={hol && !hol.isWorking ? '#fef3c7' : '#f1f5f9'}
                    opacity={0.6}
                  >
                    <title>{hol ? hol.name : 'Weekend'}</title>
                  </rect>
                );
              })}

              {/* row separators */}
              {rows.map((r, i) => (
                <line
                  key={`sep-${i}`}
                  x1={0} x2={gridWidth}
                  y1={rowOffsets[i] + (r.kind === 'phase' ? PHASE_HEADER_H : TASK_ROW_H)}
                  y2={rowOffsets[i] + (r.kind === 'phase' ? PHASE_HEADER_H : TASK_ROW_H)}
                  stroke="#e2e8f0"
                />
              ))}

              {/* phase + task bars */}
              {rows.map((r, i) => {
                const y = rowOffsets[i];
                if (r.kind === 'phase') {
                  if (!r.data.computedStart || !r.data.computedEnd) return null;
                  const x = xFor(r.data.computedStart);
                  const w = widthFor(r.data.computedStart, r.data.computedEnd);
                  const color = deptColor(r.data.departmentId);
                  return (
                    <g key={`p-${i}`}>
                      <rect
                        x={x}
                        y={y + 8}
                        width={w}
                        height={PHASE_HEADER_H - 16}
                        rx={3}
                        fill={color}
                        opacity={0.18}
                        stroke={color}
                        strokeOpacity={0.5}
                      />
                    </g>
                  );
                }
                // task bar
                const t = r.data;
                const x = xFor(t.computedStart);
                const w = widthFor(t.computedStart, t.computedEnd);
                const color = deptColor(r.phase?.departmentId);
                const isDone = t.status === 'done';
                return (
                  <g
                    key={`t-${i}`}
                    onMouseEnter={() => setHover({ task: t, phase: r.phase, x, y })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <rect
                      x={x}
                      y={y + 6}
                      width={w}
                      height={TASK_ROW_H - 12}
                      rx={3}
                      fill={color}
                      opacity={isDone ? 0.5 : 0.9}
                      stroke={t.isCritical ? '#dc2626' : color}
                      strokeWidth={t.isCritical ? 2 : 1}
                    />
                    {w > 40 && (
                      <text
                        x={x + 6}
                        y={y + TASK_ROW_H / 2 + 4}
                        fontSize={11}
                        fill="#0f172a"
                        style={{ pointerEvents: 'none' }}
                      >
                        {t.name.length > Math.floor(w / 7)
                          ? t.name.slice(0, Math.floor(w / 7) - 1) + '…'
                          : t.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* today line */}
              {todayX !== null && (
                <g>
                  <line
                    x1={todayX} x2={todayX}
                    y1={0} y2={bodyHeight}
                    stroke="#0f172a"
                    strokeDasharray="4 3"
                  />
                  <text x={todayX + 4} y={12} fontSize={10} fill="#0f172a">
                    today
                  </text>
                </g>
              )}
            </g>
          </svg>

          {/* Hover tooltip */}
          {hover && (
            <div
              className="absolute pointer-events-none bg-slate-900 text-white text-xs rounded-md shadow-lg px-3 py-2 max-w-xs"
              style={{
                left: Math.min(hover.x + 12, gridWidth - 280),
                top: HEADER_H + hover.y + TASK_ROW_H + 4,
              }}
            >
              <div className="font-semibold">{hover.task.name}</div>
              <div className="font-mono text-[11px] text-slate-300 mt-0.5">
                {hover.task.computedStart} → {hover.task.computedEnd}
              </div>
              <div className="text-[11px] text-slate-300">
                {hover.task.durationDays} calendar day{hover.task.durationDays === 1 ? '' : 's'} · {hover.task.workingDaysSpan} working
              </div>
              {hover.task.isCritical && (
                <div className="text-[11px] text-red-300 mt-0.5">on critical path</div>
              )}
              {hover.phase?.name && (
                <div className="text-[11px] text-slate-400 mt-0.5">{hover.phase.name}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer legend */}
      <div className="border-t border-slate-200 px-3 py-2 flex items-center gap-4 text-xs text-slate-600 flex-wrap">
        <Swatch fill="#a78bfa" label="Strategy" />
        <Swatch fill="#38bdf8" label="Pre-prod" />
        <Swatch fill="#fbbf24" label="Production" />
        <Swatch fill="#34d399" label="Post" />
        <Swatch fill="#fef3c7" label="Holiday" />
        <Swatch fill="#f1f5f9" label="Weekend" />
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-white border-2 border-red-600 inline-block" />
          Critical path
        </span>
      </div>
    </div>
  );
}

function Swatch({ fill, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: fill }} />
      {label}
    </span>
  );
}

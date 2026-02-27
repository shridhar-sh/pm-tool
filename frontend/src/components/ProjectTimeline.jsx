import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectTimeline({ project, onUpdate }) {
  const [stages, setStages] = useState(project?.workflowStages || []);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [dates, setDates] = useState([]);

  useEffect(() => {
    if (project) {
      setStages(project.workflowStages || []);
      calculateDateRange();
    }
  }, [project]);

  const calculateDateRange = () => {
    if (!project?.projectStartDate || !project?.projectEndDate) return;
    
    const start = parseISO(project.projectStartDate);
    const end = parseISO(project.projectEndDate);
    
    const monthStart = startOfMonth(start);
    const monthEnd = endOfMonth(end);
    
    const allDates = eachDayOfInterval({ start: monthStart, end: monthEnd });
    setDates(allDates);
    setDateRange({ start: monthStart, end: monthEnd });
  };

  const getTaskTypeColor = (taskType) => {
    if (taskType === 'SS') return 'bg-blue-100 border-blue-300';
    if (taskType === 'C') return 'bg-yellow-100 border-yellow-300';
    return 'bg-gray-100 border-gray-300';
  };

  const getTaskTypeLabel = (taskType) => {
    if (taskType === 'SS') return 'ScrollStop';
    if (taskType === 'C') return 'Client';
    return 'Unknown';
  };

  const isDateInRange = (date, startDate, endDate) => {
    if (!startDate || !endDate) return false;
    const current = parseISO(date);
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return current >= start && current <= end;
  };

  const getCellColor = (stage, date) => {
    if (!stage.startDate || !stage.endDate) return '';
    
    if (isDateInRange(format(date, 'yyyy-MM-dd'), stage.startDate, stage.endDate)) {
      if (stage.completed) {
        return stage.taskType === 'SS' ? 'bg-blue-200' : 'bg-yellow-200';
      }
      if (stage.extraDays > 0) {
        return 'bg-red-200';
      }
      return stage.taskType === 'SS' ? 'bg-blue-100' : 'bg-yellow-100';
    }
    return '';
  };

  const handleStageUpdate = async (stageIndex, field, value) => {
    const updatedStages = [...stages];
    updatedStages[stageIndex][field] = value;
    
    // Auto-calculate end date when start date, duration, or extra days change
    if (field === 'startDate' || field === 'duration' || field === 'extraDays') {
      const start = updatedStages[stageIndex].startDate;
      const duration = parseInt(updatedStages[stageIndex].duration) || 0;
      const extra = parseInt(updatedStages[stageIndex].extraDays) || 0;
      
      if (start && (duration > 0 || extra > 0)) {
        const startDate = parseISO(start);
        const totalDays = duration + extra;
        const calculatedEndDate = addDays(startDate, totalDays - 1);
        updatedStages[stageIndex].endDate = format(calculatedEndDate, 'yyyy-MM-dd');
      }
    }
    
    setStages(updatedStages);
    
    if (onUpdate) {
      onUpdate({ workflowStages: updatedStages });
    }
  };

  if (!project) {
    return <div className="p-6 text-slate-500">No project selected</div>;
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{project.name}</CardTitle>
            <p className="text-sm text-slate-600 mt-1">{project.client} | {project.sow}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getTaskTypeColor('SS') + ' text-xs'}>SS = ScrollStop</Badge>
            <Badge className={getTaskTypeColor('C') + ' text-xs'}>C = Client</Badge>
            <Button size="sm" variant="outline" data-testid="export-timeline-button">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div>
            <span className="text-slate-500">Start:</span>
            <span className="font-semibold ml-2 mono">{project.projectStartDate}</span>
          </div>
          <div>
            <span className="text-slate-500">End:</span>
            <span className="font-semibold ml-2 mono">{project.projectEndDate}</span>
          </div>
          <div>
            <span className="text-slate-500">CS:</span>
            <span className="font-semibold ml-2">{project.csDoneBy}</span>
          </div>
          <div>
            <span className="text-slate-500">Extra Days:</span>
            <span className="font-semibold ml-2 text-red-600">{project.extraDays || 0}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr>
                <th className="border border-slate-200 p-2 text-left min-w-[180px] sticky left-0 bg-slate-50 z-20">Task</th>
                <th className="border border-slate-200 p-2 min-w-[80px]">Type</th>
                <th className="border border-slate-200 p-2 min-w-[120px]">Start Date</th>
                <th className="border border-slate-200 p-2 min-w-[120px]">End Date</th>
                <th className="border border-slate-200 p-2 min-w-[80px]">Days</th>
                <th className="border border-slate-200 p-2 min-w-[80px]">Extra</th>
                {dates.map((date, idx) => (
                  <th key={idx} className="border border-slate-200 p-1 min-w-[30px] text-center text-xs">
                    <div className="transform -rotate-45 origin-center whitespace-nowrap">
                      {format(date, 'dd')}
                    </div>
                    <div className="text-[10px] text-slate-500">{format(date, 'MMM')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, stageIdx) => (
                <tr key={stageIdx} className="hover:bg-slate-50">
                  <td className="border border-slate-200 p-2 font-medium sticky left-0 bg-white z-10">
                    {stage.name}
                  </td>
                  <td className="border border-slate-200 p-1 text-center">
                    <Badge className={getTaskTypeColor(stage.taskType) + ' text-xs border'}>
                      {stage.taskType}
                    </Badge>
                  </td>
                  <td className="border border-slate-200 p-1">
                    <Input
                      type="date"
                      value={stage.startDate || ''}
                      onChange={(e) => handleStageUpdate(stageIdx, 'startDate', e.target.value)}
                      className="h-8 text-xs"
                      data-testid={`stage-${stageIdx}-start-date`}
                    />
                  </td>
                  <td className="border border-slate-200 p-1">
                    <Input
                      type="date"
                      value={stage.endDate || ''}
                      onChange={(e) => handleStageUpdate(stageIdx, 'endDate', e.target.value)}
                      className="h-8 text-xs"
                      data-testid={`stage-${stageIdx}-end-date`}
                    />
                  </td>
                  <td className="border border-slate-200 p-2 text-center mono text-xs">
                    {stage.duration || 0}
                  </td>
                  <td className="border border-slate-200 p-2 text-center mono text-xs text-red-600">
                    {stage.extraDays || 0}
                  </td>
                  {dates.map((date, dateIdx) => {
                    const cellColor = getCellColor(stage, date);
                    return (
                      <td
                        key={dateIdx}
                        className={`border border-slate-200 p-0 ${cellColor}`}
                        style={{ minWidth: '30px', height: '40px' }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

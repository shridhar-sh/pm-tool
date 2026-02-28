import { useState, useEffect } from 'react';
import * as dateFns from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectTimeline({ project, onUpdate }) {
  const [stages, setStages] = useState(project?.workflowStages || []);
  const [dates, setDates] = useState([]);
  const [extraDayMarkers, setExtraDayMarkers] = useState({});

  useEffect(() => {
    if (project) {
      setStages(project.workflowStages || []);
      calculateDates();
      autoCalculateStageDates(project.workflowStages);
    }
  }, [project]);

  const autoCalculateStageDates = (workflowStages) => {
    if (!project?.projectStartDate) return;
    
    const updatedStages = [...workflowStages];
    let currentDate = dateFns.parseISO(project.projectStartDate);
    
    updatedStages.forEach((stage) => {
      stage.startDate = dateFns.format(currentDate, 'yyyy-MM-dd');
      
      if (stage.duration > 0) {
        const totalDays = stage.duration + (stage.extraDays || 0);
        const endDate = dateFns.addDays(currentDate, totalDays - 1);
        stage.endDate = dateFns.format(endDate, 'yyyy-MM-dd');
        currentDate = dateFns.addDays(endDate, 1);
      } else {
        stage.endDate = null;
      }
    });
    
    setStages(updatedStages);
    if (onUpdate) onUpdate({ workflowStages: updatedStages });
  };

  const calculateDates = () => {
    if (!project?.projectStartDate || !project?.projectEndDate) return;
    
    const start = dateFns.parseISO(project.projectStartDate);
    const end = dateFns.parseISO(project.projectEndDate);
    const monthStart = dateFns.startOfMonth(start);
    const monthEnd = dateFns.endOfMonth(end);
    const allDates = dateFns.eachDayOfInterval({ start: monthStart, end: monthEnd });
    setDates(allDates);
  };

  const handleStageUpdate = (stageIndex, field, value) => {
    const updatedStages = [...stages];
    updatedStages[stageIndex][field] = value;
    
    if (field === 'duration' || field === 'extraDays') {
      autoCalculateStageDates(updatedStages);
      return;
    }
    
    setStages(updatedStages);
    if (onUpdate) onUpdate({ workflowStages: updatedStages });
  };

  const handleAddExtraDay = (stageIndex, date) => {
    const dateStr = dateFns.format(date, 'yyyy-MM-dd');
    const key = `${stageIndex}-${dateStr}`;
    
    const newMarkers = { ...extraDayMarkers };
    if (newMarkers[key]) {
      delete newMarkers[key];
    } else {
      newMarkers[key] = true;
    }
    setExtraDayMarkers(newMarkers);
    
    const stageMarkers = Object.keys(newMarkers).filter(k => k.startsWith(`${stageIndex}-`)).length;
    const updatedStages = [...stages];
    updatedStages[stageIndex].extraDays = stageMarkers;
    autoCalculateStageDates(updatedStages);
  };

  const isDateInRange = (date, startDate, endDate) => {
    if (!startDate || !endDate) return false;
    const current = dateFns.parseISO(date);
    const start = dateFns.parseISO(startDate);
    const end = dateFns.parseISO(endDate);
    return current >= start && current <= end;
  };

  const getCellColor = (stage, date, stageIdx) => {
    if (!stage.startDate || !stage.endDate) return '';
    
    const dateStr = dateFns.format(date, 'yyyy-MM-dd');
    const key = `${stageIdx}-${dateStr}`;
    
    if (extraDayMarkers[key]) return 'bg-red-300';
    
    if (isDateInRange(dateStr, stage.startDate, stage.endDate)) {
      if (stage.completed) {
        return stage.taskType === 'SS' ? 'bg-blue-200' : 'bg-yellow-200';
      }
      return stage.taskType === 'SS' ? 'bg-blue-100' : 'bg-yellow-100';
    }
    return '';
  };

  if (!project) return <div className="p-6 text-slate-500">No project selected</div>;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{project.name}</CardTitle>
            <p className="text-sm text-slate-600 mt-1">{project.client} | {project.sow}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">SS = ScrollStop</Badge>
            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">C = Client</Badge>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div>
            <span className="text-slate-500">Start:</span>
            <span className="font-semibold ml-2">{project.projectStartDate}</span>
          </div>
          <div>
            <span className="text-slate-500">End:</span>
            <span className="font-semibold ml-2">{project.projectEndDate}</span>
          </div>
          <div>
            <span className="text-slate-500">CS:</span>
            <span className="font-semibold ml-2">{project.csDoneBy}</span>
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
                <th className="border border-slate-200 p-2 min-w-[80px]">Days</th>
                <th className="border border-slate-200 p-2 min-w-[80px]">Extra Days</th>
                <th className="border border-slate-200 p-2 min-w-[120px] bg-slate-100">End Date (Auto)</th>
                {dates.map((date, idx) => (
                  <th key={idx} className="border border-slate-200 p-1 min-w-[30px] text-center text-xs">
                    <div className="text-[10px]">{dateFns.format(date, 'dd MMM')}</div>
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
                    <Badge className={(stage.taskType === 'SS' ? 'bg-blue-100 border-blue-300' : 'bg-yellow-100 border-yellow-300') + ' text-xs border'}>
                      {stage.taskType}
                    </Badge>
                  </td>
                  <td className="border border-slate-200 p-2 bg-slate-50 mono text-xs text-center">
                    {stage.startDate || '-'}
                  </td>
                  <td className="border border-slate-200 p-1">
                    <Input
                      type="number"
                      min="0"
                      value={stage.duration || ''}
                      onChange={(e) => handleStageUpdate(stageIdx, 'duration', e.target.value)}
                      placeholder="Days"
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="border border-slate-200 p-2 text-center mono text-xs text-red-600">
                    {stage.extraDays || 0}
                  </td>
                  <td className="border border-slate-200 p-2 bg-slate-50 mono text-xs text-center">
                    {stage.endDate || '-'}
                  </td>
                  {dates.map((date, dateIdx) => {
                    const cellColor = getCellColor(stage, date, stageIdx);
                    const dateStr = dateFns.format(date, 'yyyy-MM-dd');
                    const key = `${stageIdx}-${dateStr}`;
                    const hasE = extraDayMarkers[key];
                    
                    return (
                      <td
                        key={dateIdx}
                        onClick={() => handleAddExtraDay(stageIdx, date)}
                        className={`border border-slate-200 p-0 cursor-pointer hover:ring-2 hover:ring-blue-400 ${cellColor}`}
                        style={{ minWidth: '30px', height: '40px' }}
                        title="Click to add/remove E"
                      >
                        {hasE && <div className="flex items-center justify-center h-full font-bold text-red-700 text-xs">E</div>}
                      </td>
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

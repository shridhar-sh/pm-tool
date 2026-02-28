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
  const [extraDayMarkers, setExtraDayMarkers] = useState({}); // {stageIdx-dateStr: true}

  useEffect(() => {
    if (project) {
      setStages(project.workflowStages || []);
      calculateDateRange();
      autoCalculateStageDates(project.workflowStages);
    }
  }, [project]);

  const autoCalculateStageDates = (workflowStages) => {
    if (!project?.projectStartDate) return;
    
    const updatedStages = [...workflowStages];
    let currentDate = parseISO(project.projectStartDate);
    
    updatedStages.forEach((stage, idx) => {
      // Set start date (first stage uses project start, others use day after previous ends)
      stage.startDate = format(currentDate, 'yyyy-MM-dd');
      
      // Calculate end date if duration is set
      if (stage.duration > 0) {
        const totalDays = stage.duration + (stage.extraDays || 0);
        const endDate = addDays(currentDate, totalDays - 1);
        stage.endDate = format(endDate, 'yyyy-MM-dd');
        
        // Next stage starts day after this ends
        currentDate = addDays(endDate, 1);
      } else {
        stage.endDate = null;
        // If no duration, next stage starts same day
      }
    });
    
    setStages(updatedStages);
    if (onUpdate) {
      onUpdate({ workflowStages: updatedStages });
    }
  };

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
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${stages.indexOf(stage)}-${dateStr}`;
    
    // Show E marker
    if (extraDayMarkers[key]) {
      return 'bg-red-300 relative';
    }
    
    if (isDateInRange(dateStr, stage.startDate, stage.endDate)) {
      if (stage.completed) {
        return stage.taskType === 'SS' ? 'bg-blue-200' : 'bg-yellow-200';
      }
      if (stage.extraDays > 0) {
        return 'bg-red-100';
      }
      return stage.taskType === 'SS' ? 'bg-blue-100' : 'bg-yellow-100';
    }
    return '';
  };

  const handleStageUpdate = async (stageIndex, field, value) => {
    const updatedStages = [...stages];
    updatedStages[stageIndex][field] = value;
    
    // Auto-calculate dates when duration or extra days change
    if (field === 'duration' || field === 'extraDays') {
      autoCalculateStageDates(updatedStages);
      return; // autoCalculateStageDates already calls onUpdate
    }
    
    setStages(updatedStages);
    
    if (onUpdate) {
      onUpdate({ workflowStages: updatedStages });
    }
  };

  const handleAddExtraDay = (stageIndex, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${stageIndex}-${dateStr}`;
    
    // Toggle E marker
    const newMarkers = { ...extraDayMarkers };
    if (newMarkers[key]) {
      delete newMarkers[key];
    } else {
      newMarkers[key] = true;
    }
    setExtraDayMarkers(newMarkers);
    
    // Count total E markers for this stage
    const stageMarkers = Object.keys(newMarkers).filter(k => k.startsWith(`${stageIndex}-`)).length;
    
    // Update stage extra days
    const updatedStages = [...stages];
    updatedStages[stageIndex].extraDays = stageMarkers;
    
    // Recalculate all dates
    autoCalculateStageDates(updatedStages);
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
                <th className="border border-slate-200 p-2 min-w-[80px]\">Type</th>
                <th className="border border-slate-200 p-2 min-w-[120px]">Start Date</th>
                <th className="border border-slate-200 p-2 min-w-[80px]">Days</th>
                <th className="border border-slate-200 p-2 min-w-[80px]">Extra Days</th>
                <th className="border border-slate-200 p-2 min-w-[120px] bg-slate-100">End Date (Auto)</th>
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
                      type="number"
                      min="0"
                      value={stage.duration || ''}
                      onChange={(e) => handleStageUpdate(stageIdx, 'duration', e.target.value)}
                      placeholder="Days"
                      className="h-8 text-xs"
                      data-testid={`stage-${stageIdx}-duration`}
                    />
                  </td>
                  <td className="border border-slate-200 p-1">
                    <Input
                      type="number"
                      min="0"
                      value={stage.extraDays || ''}
                      onChange={(e) => handleStageUpdate(stageIdx, 'extraDays', e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                      data-testid={`stage-${stageIdx}-extra-days`}
                    />
                  </td>
                  <td className="border border-slate-200 p-2 bg-slate-50 mono text-xs text-center">
                    {stage.endDate || '-'}
                  </td>
                  {dates.map((date, dateIdx) => {
                    const cellColor = getCellColor(stage, date);
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const key = `${stageIdx}-${dateStr}`;
                    const hasE = extraDayMarkers[key];
                    
                    return (
                      <td
                        key={dateIdx}
                        onClick={() => handleAddExtraDay(stageIdx, date)}
                        className={`border border-slate-200 p-0 cursor-pointer hover:ring-2 hover:ring-blue-400 ${cellColor}`}
                        style={{ minWidth: '30px', height: '40px' }}
                        title="Click to add/remove extra day (E)"
                      >
                        {hasE && (
                          <div className="flex items-center justify-center h-full font-bold text-red-700 text-xs">
                            E
                          </div>
                        )}
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

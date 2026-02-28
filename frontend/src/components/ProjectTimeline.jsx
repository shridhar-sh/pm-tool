import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, addDays, eachDayOfInterval, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ProjectTimeline({ project, onUpdate }) {
  const [stages, setStages] = useState([]);
  const [dates, setDates] = useState([]);
  const [extraDayMarkers, setExtraDayMarkers] = useState({});

  // Calculate timeline dates for the header
  const calculateTimelineDates = useCallback(() => {
    if (!project?.projectStartDate || !project?.projectEndDate) return;
    
    try {
      const start = parseISO(project.projectStartDate);
      const end = parseISO(project.projectEndDate);
      const monthStart = startOfMonth(start);
      const monthEnd = endOfMonth(end);
      const allDates = eachDayOfInterval({ start: monthStart, end: monthEnd });
      setDates(allDates);
    } catch (err) {
      console.error('Error calculating dates:', err);
    }
  }, [project?.projectStartDate, project?.projectEndDate]);

  // Auto-calculate stage dates based on duration and extra days
  const autoCalculateStageDates = useCallback((workflowStages) => {
    if (!project?.projectStartDate || !workflowStages?.length) return workflowStages;
    
    try {
      const updatedStages = [...workflowStages];
      let currentDate = parseISO(project.projectStartDate);
      
      updatedStages.forEach((stage) => {
        stage.startDate = format(currentDate, 'yyyy-MM-dd');
        
        const duration = parseInt(stage.duration) || 0;
        const extraDays = parseInt(stage.extraDays) || 0;
        
        if (duration > 0) {
          const totalDays = duration + extraDays;
          const endDate = addDays(currentDate, totalDays - 1);
          stage.endDate = format(endDate, 'yyyy-MM-dd');
          currentDate = addDays(endDate, 1); // Next stage starts day after
        } else {
          stage.endDate = null;
          // If no duration set, next stage still starts from same date
        }
      });
      
      return updatedStages;
    } catch (err) {
      console.error('Error auto-calculating dates:', err);
      return workflowStages;
    }
  }, [project?.projectStartDate]);

  // Initialize stages when project changes
  useEffect(() => {
    if (project?.workflowStages) {
      const calculatedStages = autoCalculateStageDates(project.workflowStages);
      setStages(calculatedStages);
    }
    calculateTimelineDates();
  }, [project, autoCalculateStageDates, calculateTimelineDates]);

  // Handle stage field updates
  const handleStageUpdate = (stageIndex, field, value) => {
    const updatedStages = [...stages];
    
    if (field === 'duration') {
      updatedStages[stageIndex].duration = parseInt(value) || 0;
    } else if (field === 'extraDays') {
      updatedStages[stageIndex].extraDays = parseInt(value) || 0;
    } else {
      updatedStages[stageIndex][field] = value;
    }
    
    // Recalculate all dates when duration or extraDays changes
    if (field === 'duration' || field === 'extraDays') {
      const recalculatedStages = autoCalculateStageDates(updatedStages);
      setStages(recalculatedStages);
      if (onUpdate) {
        onUpdate({ workflowStages: recalculatedStages });
      }
    } else {
      setStages(updatedStages);
      if (onUpdate) {
        onUpdate({ workflowStages: updatedStages });
      }
    }
  };

  // Handle clicking on a timeline cell to add/remove "E" marker
  const handleAddExtraDay = (stageIndex, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${stageIndex}-${dateStr}`;
    
    const newMarkers = { ...extraDayMarkers };
    if (newMarkers[key]) {
      delete newMarkers[key];
    } else {
      newMarkers[key] = true;
    }
    setExtraDayMarkers(newMarkers);
    
    // Count markers for this stage and update extraDays
    const stageMarkerCount = Object.keys(newMarkers)
      .filter(k => k.startsWith(`${stageIndex}-`))
      .length;
    
    const updatedStages = [...stages];
    updatedStages[stageIndex].extraDays = stageMarkerCount;
    
    // Recalculate all dates
    const recalculatedStages = autoCalculateStageDates(updatedStages);
    setStages(recalculatedStages);
    
    if (onUpdate) {
      onUpdate({ workflowStages: recalculatedStages });
    }
    
    toast.success(newMarkers[key] ? 'Extra day added - dates recalculated' : 'Extra day removed - dates recalculated');
  };

  // Check if a date falls within a stage's range
  const isDateInStageRange = (date, stage) => {
    if (!stage.startDate || !stage.endDate) return false;
    try {
      const dateToCheck = typeof date === 'string' ? parseISO(date) : date;
      const stageStart = parseISO(stage.startDate);
      const stageEnd = parseISO(stage.endDate);
      return isWithinInterval(dateToCheck, { start: stageStart, end: stageEnd });
    } catch {
      return false;
    }
  };

  // Get cell color based on stage type and completion
  const getCellColor = (stage, date, stageIdx) => {
    if (!stage.startDate || !stage.endDate) return '';
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const markerKey = `${stageIdx}-${dateStr}`;
    
    // "E" marker cells - red
    if (extraDayMarkers[markerKey]) {
      return 'bg-red-300';
    }
    
    // Check if date is in stage range
    if (isDateInStageRange(date, stage)) {
      // SS (ScrollStop) tasks - blue
      if (stage.taskType === 'SS') {
        return stage.completed ? 'bg-blue-400' : 'bg-blue-100';
      }
      // C (Client) tasks - yellow
      return stage.completed ? 'bg-yellow-400' : 'bg-yellow-100';
    }
    
    return '';
  };

  // Get department badge color
  const getDeptColor = (dept) => {
    const colors = {
      'strategy': 'bg-purple-100 text-purple-700 border-purple-300',
      'pre_production': 'bg-blue-100 text-blue-700 border-blue-300',
      'production': 'bg-amber-100 text-amber-700 border-amber-300',
      'post_production': 'bg-green-100 text-green-700 border-green-300'
    };
    return colors[dept] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  if (!project) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-12 text-center text-slate-500">
          Select a project to view its timeline
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border border-slate-200 shadow-sm" data-testid="project-timeline">
        <CardHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{project.name}</CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                {project.client} | {project.sow || 'No SOW specified'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">SS = ScrollStop</Badge>
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">C = Client</Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click on any cell to add an "E" (Extra Day).</p>
                  <p>This will push all subsequent dates forward.</p>
                </TooltipContent>
              </Tooltip>
              <Button size="sm" variant="outline" data-testid="export-timeline-btn">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div>
              <span className="text-slate-500">Start:</span>
              <span className="font-semibold ml-2">{project.projectStartDate}</span>
            </div>
            <div>
              <span className="text-slate-500">End:</span>
              <span className="font-semibold ml-2">{project.projectEndDate}</span>
            </div>
            <div>
              <span className="text-slate-500">POD:</span>
              <span className="font-semibold ml-2">{project.pod}</span>
            </div>
            <div>
              <span className="text-slate-500">CS:</span>
              <span className="font-semibold ml-2">{project.csDoneBy}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-testid="timeline-table">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr>
                  <th className="border border-slate-200 p-2 text-left min-w-[180px] sticky left-0 bg-slate-50 z-20">
                    Task
                  </th>
                  <th className="border border-slate-200 p-2 min-w-[70px] text-center">Type</th>
                  <th className="border border-slate-200 p-2 min-w-[100px] text-center">Dept</th>
                  <th className="border border-slate-200 p-2 min-w-[70px] text-center">Days</th>
                  <th className="border border-slate-200 p-2 min-w-[70px] text-center text-red-600">+Extra</th>
                  <th className="border border-slate-200 p-2 min-w-[100px] text-center bg-slate-100">Start</th>
                  <th className="border border-slate-200 p-2 min-w-[100px] text-center bg-slate-100">End</th>
                  {dates.map((date, idx) => (
                    <th key={idx} className="border border-slate-200 p-1 min-w-[30px] text-center text-xs">
                      <div className="text-[10px] leading-tight">
                        <div>{format(date, 'dd')}</div>
                        <div className="text-slate-400">{format(date, 'MMM')}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, stageIdx) => (
                  <tr key={stageIdx} className="hover:bg-slate-50" data-testid={`stage-row-${stageIdx}`}>
                    <td className="border border-slate-200 p-2 font-medium sticky left-0 bg-white z-10">
                      {stage.name}
                    </td>
                    <td className="border border-slate-200 p-1 text-center">
                      <Badge className={`text-xs border ${stage.taskType === 'SS' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-yellow-100 border-yellow-300 text-yellow-700'}`}>
                        {stage.taskType}
                      </Badge>
                    </td>
                    <td className="border border-slate-200 p-1 text-center">
                      <Badge className={`text-xs border ${getDeptColor(stage.department)}`}>
                        {stage.department?.replace('_', ' ') || '-'}
                      </Badge>
                    </td>
                    <td className="border border-slate-200 p-1">
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={stage.duration || ''}
                        onChange={(e) => handleStageUpdate(stageIdx, 'duration', e.target.value)}
                        placeholder="0"
                        className="h-8 text-xs text-center w-16 mx-auto"
                        data-testid={`stage-duration-${stageIdx}`}
                      />
                    </td>
                    <td className="border border-slate-200 p-2 text-center font-mono text-xs text-red-600 font-bold">
                      {stage.extraDays || 0}
                    </td>
                    <td className="border border-slate-200 p-2 bg-slate-50 font-mono text-xs text-center">
                      {stage.startDate || '-'}
                    </td>
                    <td className="border border-slate-200 p-2 bg-slate-50 font-mono text-xs text-center">
                      {stage.endDate || '-'}
                    </td>
                    {dates.map((date, dateIdx) => {
                      const cellColor = getCellColor(stage, date, stageIdx);
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const markerKey = `${stageIdx}-${dateStr}`;
                      const hasE = extraDayMarkers[markerKey];
                      
                      return (
                        <td
                          key={dateIdx}
                          onClick={() => handleAddExtraDay(stageIdx, date)}
                          className={`border border-slate-200 p-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${cellColor}`}
                          style={{ minWidth: '30px', height: '36px' }}
                          title={`Click to ${hasE ? 'remove' : 'add'} extra day`}
                          data-testid={`cell-${stageIdx}-${dateIdx}`}
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
          
          {/* Legend */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                <span>SS Task (Pending)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-400 border border-blue-500 rounded"></div>
                <span>SS Task (Done)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                <span>Client Task (Pending)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 border border-yellow-500 rounded"></div>
                <span>Client Task (Done)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-300 border border-red-400 rounded flex items-center justify-center text-[8px] font-bold text-red-700">E</div>
                <span>Extra Day (Click to toggle)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

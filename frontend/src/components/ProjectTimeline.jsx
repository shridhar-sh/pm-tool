import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, addDays, eachDayOfInterval, startOfMonth, endOfMonth, isWithinInterval, getDay, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Info } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProjectTimeline({ project, onUpdate }) {
  const [stages, setStages] = useState([]);
  const [dates, setDates] = useState([]);
  const [extraDayMarkers, setExtraDayMarkers] = useState({}); // { 'YYYY-MM-DD': true }
  const [holidays, setHolidays] = useState([]);
  const [workingWeekends, setWorkingWeekends] = useState({}); // { 'YYYY-MM-DD': true } for weekends marked as working

  // Fetch holidays on mount
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await axios.get(`${API}/holidays`);
        setHolidays(response.data);
      } catch (err) {
        console.error('Error fetching holidays:', err);
      }
    };
    fetchHolidays();
  }, []);

  // Check if a date is a holiday
  const isHoliday = useCallback((date) => {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const holiday = holidays.find(h => h.date === dateStr);
    return holiday && !holiday.isWorking;
  }, [holidays]);

  // Check if a date is a weekend (Sat=6, Sun=0)
  const isWeekend = useCallback((date) => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    const day = getDay(d);
    return day === 0 || day === 6;
  }, []);

  // Check if a date is a non-working day (weekend or holiday, unless marked as working)
  const isNonWorkingDay = useCallback((date) => {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    
    // If marked as working weekend, it's a working day
    if (workingWeekends[dateStr]) return false;
    
    // Check if it's a holiday (that's not marked as working)
    if (isHoliday(date)) return true;
    
    // Check if it's a weekend
    if (isWeekend(date)) return true;
    
    return false;
  }, [isHoliday, isWeekend, workingWeekends]);

  // Get the next working day from a given date
  const getNextWorkingDay = useCallback((date) => {
    let current = typeof date === 'string' ? parseISO(date) : date;
    while (isNonWorkingDay(current)) {
      current = addDays(current, 1);
    }
    return current;
  }, [isNonWorkingDay]);

  // Add working days to a date (skipping non-working days)
  const addWorkingDays = useCallback((startDate, days) => {
    if (days <= 0) return startDate;
    
    let current = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    let daysAdded = 0;
    
    // Start date should be a working day
    current = getNextWorkingDay(current);
    
    // First day counts as day 1
    daysAdded = 1;
    
    while (daysAdded < days) {
      current = addDays(current, 1);
      if (!isNonWorkingDay(current)) {
        daysAdded++;
      }
    }
    
    return current;
  }, [isNonWorkingDay, getNextWorkingDay]);

  // Calculate timeline dates for the header
  const calculateTimelineDates = useCallback(() => {
    if (!project?.projectStartDate) return;
    
    try {
      const start = parseISO(project.projectStartDate);
      // Calculate end based on stages or add 60 days
      const projectEnd = project.projectEndDate ? parseISO(project.projectEndDate) : addDays(start, 60);
      const monthStart = startOfMonth(start);
      const monthEnd = endOfMonth(projectEnd);
      const allDates = eachDayOfInterval({ start: monthStart, end: monthEnd });
      setDates(allDates);
    } catch (err) {
      console.error('Error calculating dates:', err);
    }
  }, [project?.projectStartDate, project?.projectEndDate]);

  // Find which stage a date belongs to based on the E marker logic
  // E marker on a date adds to:
  // 1. The stage whose range contains that date
  // 2. OR the previous stage if the date is the day after that stage's end date
  const findStageForExtraDay = useCallback((dateStr, currentStages) => {
    const targetDate = parseISO(dateStr);
    
    for (let i = 0; i < currentStages.length; i++) {
      const stage = currentStages[i];
      if (!stage.startDate || !stage.endDate) continue;
      
      const stageStart = parseISO(stage.startDate);
      const stageEnd = parseISO(stage.endDate);
      const dayAfterEnd = addDays(stageEnd, 1);
      
      // Check if date is within stage range
      if (isWithinInterval(targetDate, { start: stageStart, end: stageEnd })) {
        return i;
      }
      
      // Check if date is the day after stage end (pushes this stage)
      if (isSameDay(targetDate, dayAfterEnd)) {
        return i;
      }
    }
    
    // If no stage found, find the closest previous stage
    for (let i = currentStages.length - 1; i >= 0; i--) {
      const stage = currentStages[i];
      if (stage.endDate && parseISO(stage.endDate) < targetDate) {
        return i;
      }
    }
    
    return -1;
  }, []);

  // Auto-calculate stage dates based on duration, extra days, and non-working days
  const autoCalculateStageDates = useCallback((workflowStages, extraMarkers = {}) => {
    if (!project?.projectStartDate || !workflowStages?.length) return workflowStages;
    
    try {
      const updatedStages = workflowStages.map(s => ({ ...s, extraDays: 0 }));
      
      // First pass: count extra day markers for each stage
      Object.keys(extraMarkers).forEach(dateStr => {
        const stageIdx = findStageForExtraDay(dateStr, updatedStages);
        if (stageIdx >= 0) {
          updatedStages[stageIdx].extraDays = (updatedStages[stageIdx].extraDays || 0) + 1;
        }
      });
      
      // Second pass: calculate dates
      let currentDate = getNextWorkingDay(parseISO(project.projectStartDate));
      
      updatedStages.forEach((stage) => {
        stage.startDate = format(currentDate, 'yyyy-MM-dd');
        
        const duration = parseInt(stage.duration) || 0;
        const extraDays = parseInt(stage.extraDays) || 0;
        const totalDays = duration + extraDays;
        
        if (totalDays > 0) {
          const endDate = addWorkingDays(currentDate, totalDays);
          stage.endDate = format(endDate, 'yyyy-MM-dd');
          // Next stage starts the next working day after this stage ends
          currentDate = getNextWorkingDay(addDays(endDate, 1));
        } else {
          stage.endDate = null;
        }
      });
      
      return updatedStages;
    } catch (err) {
      console.error('Error auto-calculating dates:', err);
      return workflowStages;
    }
  }, [project?.projectStartDate, findStageForExtraDay, getNextWorkingDay, addWorkingDays]);

  // Initialize stages when project changes
  useEffect(() => {
    if (project?.workflowStages) {
      const calculatedStages = autoCalculateStageDates(project.workflowStages, extraDayMarkers);
      setStages(calculatedStages);
    }
    calculateTimelineDates();
  }, [project, autoCalculateStageDates, calculateTimelineDates, extraDayMarkers]);

  // Handle stage field updates
  const handleStageUpdate = (stageIndex, field, value) => {
    const updatedStages = [...stages];
    
    if (field === 'duration') {
      updatedStages[stageIndex].duration = parseInt(value) || 0;
    } else {
      updatedStages[stageIndex][field] = value;
    }
    
    // Recalculate all dates when duration changes
    if (field === 'duration') {
      const recalculatedStages = autoCalculateStageDates(updatedStages, extraDayMarkers);
      setStages(recalculatedStages);
      
      // Calculate project end date from last stage
      const lastStage = recalculatedStages[recalculatedStages.length - 1];
      const projectEndDate = lastStage?.endDate || project.projectEndDate;
      
      if (onUpdate) {
        onUpdate({ 
          workflowStages: recalculatedStages,
          projectEndDate: projectEndDate
        });
      }
    } else {
      setStages(updatedStages);
    }
  };

  // Handle clicking on a timeline cell to add/remove "E" marker (date-based)
  const handleCellClick = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check if it's a weekend - toggle working status
    if (isWeekend(date) && !isHoliday(date)) {
      const newWorkingWeekends = { ...workingWeekends };
      if (newWorkingWeekends[dateStr]) {
        delete newWorkingWeekends[dateStr];
        toast.info('Weekend marked as non-working');
      } else {
        newWorkingWeekends[dateStr] = true;
        toast.success('Weekend marked as working (C)');
      }
      setWorkingWeekends(newWorkingWeekends);
      
      // Recalculate stages
      const recalculatedStages = autoCalculateStageDates(stages, extraDayMarkers);
      setStages(recalculatedStages);
      return;
    }
    
    // For regular days, toggle E marker
    const newMarkers = { ...extraDayMarkers };
    if (newMarkers[dateStr]) {
      delete newMarkers[dateStr];
      toast.info('Extra day removed - dates recalculated');
    } else {
      newMarkers[dateStr] = true;
      toast.success('Extra day added (E) - dates pushed forward');
    }
    setExtraDayMarkers(newMarkers);
    
    // Recalculate stages with new markers
    const recalculatedStages = autoCalculateStageDates(stages, newMarkers);
    setStages(recalculatedStages);
    
    // Calculate project end date from last stage
    const lastStage = recalculatedStages[recalculatedStages.length - 1];
    const projectEndDate = lastStage?.endDate || project.projectEndDate;
    
    if (onUpdate) {
      onUpdate({ 
        workflowStages: recalculatedStages,
        projectEndDate: projectEndDate
      });
    }
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

  // Get cell styling
  const getCellStyle = (date, stageIdx) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const stage = stages[stageIdx];
    const isInRange = isDateInStageRange(date, stage);
    const hasEMarker = extraDayMarkers[dateStr];
    const isWeekendDay = isWeekend(date);
    const isHolidayDay = isHoliday(date);
    const isWorkingWeekend = workingWeekends[dateStr];
    
    let bgColor = '';
    let textContent = '';
    
    // E marker takes precedence
    if (hasEMarker) {
      bgColor = 'bg-red-300';
      textContent = 'E';
    }
    // Working weekend (C marker)
    else if (isWeekendDay && isWorkingWeekend && isInRange) {
      bgColor = stage.taskType === 'SS' ? 'bg-blue-200' : 'bg-yellow-200';
      textContent = 'C';
    }
    // Non-working days
    else if (isWeekendDay || isHolidayDay) {
      bgColor = 'bg-slate-200';
    }
    // In stage range
    else if (isInRange) {
      if (stage.taskType === 'SS') {
        bgColor = stage.completed ? 'bg-blue-400' : 'bg-blue-100';
      } else {
        bgColor = stage.completed ? 'bg-yellow-400' : 'bg-yellow-100';
      }
    }
    
    return { bgColor, textContent };
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

  // Get holiday name for a date
  const getHolidayName = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const holiday = holidays.find(h => h.date === dateStr);
    return holiday?.name || null;
  };

  // Calculate project end date from last stage
  const calculatedEndDate = stages.length > 0 
    ? stages[stages.length - 1]?.endDate 
    : project?.projectEndDate;

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
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">C = Client/Working</Badge>
              <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">E = Extra Day</Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">How to use:</p>
                  <p>• Click any date to add "E" (Extra Day) - pushes all dates forward</p>
                  <p>• Click weekend to mark as "C" (Working day)</p>
                  <p>• Weekends & holidays are auto-skipped</p>
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
              <span className="font-semibold ml-2 text-green-600">{calculatedEndDate || '-'}</span>
              <span className="text-xs text-slate-400 ml-1">(auto-calculated)</span>
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
                  {dates.map((date, idx) => {
                    const isWeekendDay = isWeekend(date);
                    const holidayName = getHolidayName(date);
                    return (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <th className={`border border-slate-200 p-1 min-w-[30px] text-center text-xs ${isWeekendDay ? 'bg-slate-200' : holidayName ? 'bg-red-100' : ''}`}>
                            <div className="text-[10px] leading-tight">
                              <div>{format(date, 'dd')}</div>
                              <div className="text-slate-400">{format(date, 'MMM')}</div>
                            </div>
                          </th>
                        </TooltipTrigger>
                        {(isWeekendDay || holidayName) && (
                          <TooltipContent>
                            {holidayName || (isWeekendDay ? format(date, 'EEEE') : '')}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
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
                      const { bgColor, textContent } = getCellStyle(date, stageIdx);
                      const holidayName = getHolidayName(date);
                      const isWeekendDay = isWeekend(date);
                      
                      return (
                        <Tooltip key={dateIdx}>
                          <TooltipTrigger asChild>
                            <td
                              onClick={() => handleCellClick(date)}
                              className={`border border-slate-200 p-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${bgColor}`}
                              style={{ minWidth: '30px', height: '36px' }}
                              data-testid={`cell-${stageIdx}-${dateIdx}`}
                            >
                              {textContent && (
                                <div className={`flex items-center justify-center h-full font-bold text-xs ${textContent === 'E' ? 'text-red-700' : 'text-slate-700'}`}>
                                  {textContent}
                                </div>
                              )}
                            </td>
                          </TooltipTrigger>
                          {(holidayName || isWeekendDay) && (
                            <TooltipContent>
                              <p>{holidayName || format(date, 'EEEE')}</p>
                              <p className="text-xs text-slate-400">Click to mark as working</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Legend */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                <span>SS Task</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                <span>Client Task</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-200 border border-slate-300 rounded"></div>
                <span>Weekend/Holiday (skipped)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-300 border border-red-400 rounded flex items-center justify-center text-[8px] font-bold text-red-700">E</div>
                <span>Extra Day (click to add)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded flex items-center justify-center text-[8px] font-bold">C</div>
                <span>Working Weekend (click to toggle)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

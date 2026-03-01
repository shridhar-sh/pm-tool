import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, addDays, eachDayOfInterval, isWithinInterval, getDay, isSameDay } from 'date-fns';
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
  // Execution: date-based { 'YYYY-MM-DD': true } - affects stage calculation
  // Visual: cell-based { 'stageIdx-YYYY-MM-DD': true } - shows E only on clicked cell
  const [extraDayMarkers, setExtraDayMarkers] = useState({}); // For calculation (date-based)
  const [extraDayVisual, setExtraDayVisual] = useState({}); // For display (cell-specific)
  const [holidays, setHolidays] = useState([]);
  // Execution: column-wide { 'YYYY-MM-DD': true }
  // Visual: cell-based { 'stageIdx-YYYY-MM-DD': true } - shows W only on clicked cell
  const [workingDays, setWorkingDays] = useState({}); // For calculation (date-based)
  const [workingDaysVisual, setWorkingDaysVisual] = useState({}); // For display (cell-specific)

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

  // Get holiday info
  const getHolidayInfo = useCallback((date) => {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dateStr);
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
    
    // If manually marked as working, it's a working day
    if (workingDays[dateStr]) return false;
    
    // Check if it's a holiday (that's not marked as working in holiday settings)
    if (isHoliday(date)) return true;
    
    // Check if it's a weekend
    if (isWeekend(date)) return true;
    
    return false;
  }, [isHoliday, isWeekend, workingDays]);

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

  // Calculate timeline dates for the header - START FROM PROJECT START DATE
  const calculateTimelineDates = useCallback(() => {
    if (!project?.projectStartDate) return;
    
    try {
      const start = parseISO(project.projectStartDate);
      // Calculate end based on stages or add 60 days
      const projectEnd = project.projectEndDate ? parseISO(project.projectEndDate) : addDays(start, 60);
      // START FROM PROJECT START DATE, not month start
      const allDates = eachDayOfInterval({ start: start, end: addDays(projectEnd, 14) });
      setDates(allDates);
    } catch (err) {
      console.error('Error calculating dates:', err);
    }
  }, [project?.projectStartDate, project?.projectEndDate]);

  // Find which stage a date belongs to based on the E marker logic
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
      
      // First pass: count extra day markers for each stage using DATE-BASED logic
      // extraMarkers keys are 'YYYY-MM-DD' format - find which stage the date belongs to
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
      const projectEndDate = lastStage?.endDate || lastStage?.startDate || project.projectEndDate;
      
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

  // Handle clicking on a timeline cell to add/remove "E" marker or "W" marker
  const handleCellClick = (date, stageIdx) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const cellKey = `${stageIdx}-${dateStr}`; // Cell-specific key for VISUAL only
    const isWeekendDay = isWeekend(date);
    const holidayInfo = getHolidayInfo(date);
    
    // For weekends or holidays - toggle working status (W marker)
    // EXECUTION: column-wide (date-based)
    // VISUAL: cell-specific (only show W on clicked cell)
    if (isWeekendDay || holidayInfo) {
      const newWorkingDays = { ...workingDays };
      const newWorkingDaysVisual = { ...workingDaysVisual };
      
      if (newWorkingDays[dateStr]) {
        delete newWorkingDays[dateStr];
        // Remove all visual markers for this date
        Object.keys(newWorkingDaysVisual).forEach(key => {
          if (key.endsWith(`-${dateStr}`)) delete newWorkingDaysVisual[key];
        });
        toast.info(`${holidayInfo?.name || 'Weekend'} marked as non-working`);
      } else {
        newWorkingDays[dateStr] = true;
        newWorkingDaysVisual[cellKey] = true; // Visual only on clicked cell
        toast.success(`${holidayInfo?.name || 'Weekend'} marked as Working (W)`);
      }
      setWorkingDays(newWorkingDays);
      setWorkingDaysVisual(newWorkingDaysVisual);
      
      // Recalculate stages
      const recalculatedStages = autoCalculateStageDates(stages, extraDayMarkers);
      setStages(recalculatedStages);
      return;
    }
    
    // For regular days, toggle E marker
    // EXECUTION: date-based (affects stage based on date position)
    // VISUAL: cell-specific (only show E on clicked cell)
    const newMarkers = { ...extraDayMarkers };
    const newVisual = { ...extraDayVisual };
    
    if (newMarkers[dateStr]) {
      delete newMarkers[dateStr];
      // Remove visual marker for this date
      Object.keys(newVisual).forEach(key => {
        if (key.endsWith(`-${dateStr}`)) delete newVisual[key];
      });
      toast.info('Extra day removed - dates recalculated');
    } else {
      newMarkers[dateStr] = true; // Execution: date-based
      newVisual[cellKey] = true; // Visual: cell-specific
      toast.success('Extra day added (E) - dates pushed forward');
    }
    setExtraDayMarkers(newMarkers);
    setExtraDayVisual(newVisual);
    
    // Recalculate stages with new markers
    const recalculatedStages = autoCalculateStageDates(stages, newMarkers);
    setStages(recalculatedStages);
    
    // Calculate project end date from last stage
    const lastStage = recalculatedStages[recalculatedStages.length - 1];
    const projectEndDate = lastStage?.endDate || lastStage?.startDate || project.projectEndDate;
    
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

  // Get cell styling - E only shows on that specific cell
  const getCellStyle = (date, stageIdx) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const cellKey = `${stageIdx}-${dateStr}`; // Cell-specific key for E marker
    const stage = stages[stageIdx];
    const isInRange = isDateInStageRange(date, stage);
    const hasEMarker = extraDayMarkers[cellKey]; // Cell-specific E marker
    const isWeekendDay = isWeekend(date);
    const holidayInfo = getHolidayInfo(date);
    const isMarkedWorking = workingDays[dateStr]; // Column-wide W marker
    
    let bgColor = '';
    let textContent = '';
    
    // E marker - only on that specific cell (red background)
    if (hasEMarker) {
      bgColor = 'bg-red-300';
      textContent = 'E';
    }
    // Holiday - orange background (entire column)
    else if (holidayInfo && !holidayInfo.isWorking && !isMarkedWorking) {
      bgColor = 'bg-orange-200';
    }
    // Weekend/Holiday marked as working (W marker) - show W only in first row for visual clarity
    else if ((isWeekendDay || holidayInfo) && isMarkedWorking) {
      if (isInRange) {
        bgColor = stage.taskType === 'SS' ? 'bg-blue-200' : 'bg-yellow-200';
      } else {
        bgColor = 'bg-green-100';
      }
      // Show W only on first stage row to avoid visual clutter
      if (stageIdx === 0) {
        textContent = 'W';
      }
    }
    // Regular weekend - gray (entire column)
    else if (isWeekendDay) {
      bgColor = 'bg-slate-200';
    }
    // In stage range - normal task color
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

  // Calculate project end date from last stage (use start date if end date not available)
  const getCalculatedEndDate = () => {
    if (stages.length === 0) return project?.projectEndDate;
    const lastStage = stages[stages.length - 1];
    return lastStage?.endDate || lastStage?.startDate || project?.projectEndDate;
  };

  const calculatedEndDate = getCalculatedEndDate();

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
              <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">E = Extra Day</Badge>
              <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">W = Working</Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">How to use:</p>
                  <p>• Click any working date to add "E" (Extra Day)</p>
                  <p>• Click weekend/holiday to mark as "W" (Working)</p>
                  <p>• Weekends (gray) & holidays (orange) are auto-skipped</p>
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
                    const holidayInfo = getHolidayInfo(date);
                    const isMarkedWorking = workingDays[format(date, 'yyyy-MM-dd')];
                    
                    // Header cell colors
                    let headerBg = '';
                    if (holidayInfo && !holidayInfo.isWorking && !isMarkedWorking) {
                      headerBg = 'bg-orange-200'; // Holiday - orange
                    } else if (isWeekendDay && !isMarkedWorking) {
                      headerBg = 'bg-slate-200'; // Weekend - gray
                    }
                    
                    return (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <th className={`border border-slate-200 p-1 min-w-[30px] text-center text-xs ${headerBg}`}>
                            <div className="text-[10px] leading-tight">
                              <div>{format(date, 'dd')}</div>
                              <div className="text-slate-400">{format(date, 'MMM')}</div>
                            </div>
                          </th>
                        </TooltipTrigger>
                        {(isWeekendDay || holidayInfo) && (
                          <TooltipContent>
                            {holidayInfo?.name || format(date, 'EEEE')}
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
                      const holidayInfo = getHolidayInfo(date);
                      const isWeekendDay = isWeekend(date);
                      
                      return (
                        <Tooltip key={dateIdx}>
                          <TooltipTrigger asChild>
                            <td
                              onClick={() => handleCellClick(date, stageIdx)}
                              className={`border border-slate-200 p-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${bgColor}`}
                              style={{ minWidth: '30px', height: '36px' }}
                              data-testid={`cell-${stageIdx}-${dateIdx}`}
                            >
                              {textContent && (
                                <div className={`flex items-center justify-center h-full font-bold text-xs ${
                                  textContent === 'E' ? 'text-red-700' : 
                                  textContent === 'W' ? 'text-green-700' : 'text-slate-700'
                                }`}>
                                  {textContent}
                                </div>
                              )}
                            </td>
                          </TooltipTrigger>
                          {(holidayInfo || isWeekendDay) && (
                            <TooltipContent>
                              <p>{holidayInfo?.name || format(date, 'EEEE')}</p>
                              <p className="text-xs text-slate-400">Click to mark as Working (W)</p>
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
                <span>Client Task (C)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-200 border border-slate-300 rounded"></div>
                <span>Weekend (skipped)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-200 border border-orange-300 rounded"></div>
                <span>Holiday (skipped)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-300 border border-red-400 rounded flex items-center justify-center text-[8px] font-bold text-red-700">E</div>
                <span>Extra Day (click to add)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-400 rounded flex items-center justify-center text-[8px] font-bold text-green-700">W</div>
                <span>Working Day (click weekend/holiday)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

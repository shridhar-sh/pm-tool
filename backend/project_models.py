"""Project edit contract shared by API handlers and validation tests."""
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client: Optional[str] = None
    sow: Optional[str] = None
    csDoneBy: Optional[str] = None
    assignedAM: Optional[str] = None
    assignedLP: Optional[str] = None
    pod: Optional[str] = None
    projectStartDate: Optional[str] = None
    projectEndDate: Optional[str] = None
    statusCategory: Optional[str] = None
    extraDays: Optional[int] = Field(default=None, ge=0)
    workflowStages: Optional[List[Dict]] = None
    extraDayMarkers: Optional[Dict[str, bool]] = None
    extraDayVisual: Optional[Dict[str, bool]] = None
    workingDays: Optional[Dict[str, bool]] = None
    workingDaysVisual: Optional[Dict[str, bool]] = None
    stageOverlaps: Optional[Dict[str, int]] = None

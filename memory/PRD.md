# AgencyPM - Project Management Tool for Advertising Agency

## Original Problem Statement
Build a comprehensive, fully automated project management tool for an advertising agency, migrating from a semi-automated Google Sheet. The tool should have role-based dashboards, multiple views (AM Tracker, Timeline/Gantt, Kanban), and key automation features.

## Core Requirements

### Role-Based Dashboards
- **Project Manager (PM):** Main overview dashboard
- **Account Manager (AM):** Focused on AM Tracker view
- **Line Producer (LP):** Production-focused view
- **Team Member:** Task-focused view

### Key Views
1. **AM Tracker / List View:** Detailed table view replicating Google Sheet with checkboxes for workflow stages
2. **Timeline / Gantt View:** Visual timeline showing stages, durations, and dependencies
3. **Kanban View:** (Future) Board view for project statuses
4. **Overall View:** (Future) High-level dashboard with KPIs

### Automation Features
1. **Automated Project Creation:** Simple form creates project with default workflow stages
2. **Timeline Auto-Calculation:**
   - Stage dates cascade automatically (next stage starts day after previous ends)
   - Stage End Date = Start Date + Duration + Extra Days
   - "E" marker adds extra days and pushes subsequent dates forward
3. **Auto Status Updates:** Project status updates based on completed stages

---

## What's Been Implemented (December 2025)

### Core Infrastructure ✅
- FastAPI backend with MongoDB
- React 19 frontend with Tailwind CSS + ShadCN UI
- Role-based authentication (PM, AM, LP, Team Member)
- Main navigation structure

### Team Directory ✅
- Full CRUD for employee management
- Fields: employeeId, name, shortName, role, department, pod
- Backend API: `/api/team-members`

### AM Tracker (MyDeck.jsx) ✅
- Table view with 19 workflow stages and checkboxes
- Auto-status updates based on completed checkboxes
- Edit project functionality

### Project Timeline ✅ (Just Completed)
- Timeline component with Gantt-style visualization
- **Auto-calculation of dates:** Duration-based cascading dates
- **"E" marker functionality:** Click cells to add extra days
- **Date push forward:** Adding E markers automatically recalculates all subsequent dates
- Department-based color coding
- SS (ScrollStop) vs C (Client) task type badges
- Legend explaining color meanings

### Dashboard ✅
- KPI cards (Total, Active, In Production, Completed projects)
- POD distribution chart
- Quick actions navigation
- Recent projects list
- Add New Project dialog with dependent dropdowns

---

## Pending/Upcoming Tasks

### P1 - High Priority
- [ ] **Verify AM Tracker Auto-Status Logic:** Confirm status updates match user's workflow grouping
- [ ] **End-to-end Project Editing:** Verify edit modal saves correctly via PUT endpoint
- [ ] **Kanban View:** Implement drag-and-drop board for project statuses

### P2 - Medium Priority
- [ ] **My Tasks Page:** Build functionality for `/my-tasks` to show user's assigned tasks
- [ ] **Dashboard Enhancements:** Add more KPIs and charts
- [ ] **List View:** Implement simple list view in Project Management

### P3 - Future/Backlog
- [ ] **Export/Share:** Export project timelines to PDF or Google Sheets
- [ ] **Overall View:** High-level analytics dashboard
- [ ] **Notifications:** Alert system for task assignments and deadlines
- [ ] **Backend Refactoring:** Split server.py into routes, models, services

---

## Technical Architecture

```
/app
├── backend/
│   ├── server.py          # FastAPI app, models, routes
│   ├── requirements.txt
│   └── .env               # MONGO_URL, DB_NAME
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── ProjectTimeline.jsx  # Timeline with auto-calc
│   │   │   └── ui/                  # ShadCN components
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MyDeck.jsx           # AM Tracker
│   │   │   ├── PMDashboardNew.jsx   # Project Management
│   │   │   ├── TeamDirectory.jsx
│   │   │   └── ...
│   │   └── App.js
│   └── package.json
└── memory/
    └── PRD.md
```

### Key Database Collections
- **projects:** id, name, client, sow, csDoneBy, projectStartDate, projectEndDate, statusCategory, pod, workflowStages[]
- **team_members:** id, employeeId, name, shortName, role, department, pod, active

### API Endpoints
- `GET/POST /api/projects` - List/Create projects
- `PATCH /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `GET/POST /api/team-members` - List/Create team members
- `PATCH /api/team-members/{id}` - Update team member
- `DELETE /api/team-members/{id}` - Delete team member

---

## Test Credentials
- PM: pm@agency.com / demo123
- AM: am@agency.com / demo123
- LP: lp@agency.com / demo123
- Team: team@agency.com / demo123

---

## Known Issues Fixed
- **Babel Build Error:** Fixed by disabling visual-edits babel plugin in craco.config.js
- **useEffect Dependencies:** Fixed with proper useCallback hooks in ProjectTimeline.jsx

## Last Updated
December 2025

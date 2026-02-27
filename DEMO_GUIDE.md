# AgencyPM - Project Management Tool Demo Guide

## Overview
A fully automated project management tool for advertising agencies with role-based dashboards and workflow tracking.

## Live Application
**URL:** https://project-hub-378.preview.emergentagent.com

## Demo Accounts

All accounts use password: `demo123`

### 1. Project Manager (PM)
- **Email:** `pm@agency.com`
- **Name:** Sarah Johnson
- **Access:** Full control - Create projects, assign teams, view all projects

### 2. Account Manager (AM)
- **Email:** `am@agency.com`
- **Name:** Michael Chen
- **Access:** Manage client communication, track follow-ups, handle onboarding

### 3. Line Producer (LP)
- **Email:** `lp@agency.com`
- **Name:** Emma Davis
- **Access:** Production schedules, resource planning, shoot arrangements

### 4. Team Member
- **Email:** `team@agency.com`
- **Name:** Alex Rivera
- **Access:** View and complete assigned tasks only

## Key Features Built

### 1. **Role-Based Dashboards**
- Each role has a customized view with relevant KPIs
- Real-time project statistics
- Filtered project lists based on role assignments

### 2. **Project Workflow Tracker**
Complete workflow visualization with 6 stages:
- **Onboarding** → AM handles client onboarding
- **Strategy** → Strategist team creates plan
- **Production** → LP manages shoot and resources
- **Post-Production** → Editing and finalization
- **Client Review** → Client approval process
- **Completed** → Project closure

### 3. **Task Management**
- Create and assign tasks to team members
- Priority levels (Low, Medium, High)
- Due date tracking
- Task completion tracking
- Individual team members see only their tasks

### 4. **Approval Workflow**
- Internal approvals (team reviews)
- Client approvals (external sign-offs)
- Approve/Reject functionality
- Approval status tracking

### 5. **Notifications & Alerts**
Built-in system for:
- Deadline notifications
- Project assignments
- Delay alerts
- Escalation tracking (for delayed projects)

### 6. **Pod-Based Team Structure**
Support for organizing teams into:
- Strategist team
- Production team
- Post-production team

## Testing the Application

### As Project Manager:
1. Login with `pm@agency.com`
2. View Agency Overview dashboard
3. Create a new project (+ New Project button)
4. Assign Account Manager and Line Producer
5. Click any project card to see details
6. Move project through workflow stages
7. Create tasks and approval requests

### As Account Manager:
1. Login with `am@agency.com`
2. View your assigned projects
3. See "Needs Follow-up" counter
4. Check escalation alerts for delayed projects
5. Click projects to manage tasks and approvals

### As Line Producer:
1. Login with `lp@agency.com`
2. View production schedule
3. See projects in Production and Post-Production
4. Access project details for resource planning

### As Team Member:
1. Login with `team@agency.com`
2. View your task list
3. Mark tasks as complete using checkboxes
4. See pending, completed, and overdue counts

## Design Highlights

### Visual Style: Swiss Utility Aesthetic
- **Clean & Minimal:** Light theme with high contrast
- **Typography:** Manrope for headings, Inter for body text
- **Color Palette:**
  - Primary: Obsidian Slate (#0F172A)
  - Client-facing accent: Violet (#7C3AED)
  - Internal production: Amber (#F59E0B)
  - Success: Green, Alerts: Red
- **Layout:** Bento Grid system for dashboard widgets
- **No gradients:** Solid colors only for professional look

### Responsive Design
- Desktop: Fixed sidebar navigation
- Mobile: Sheet/Drawer navigation
- Fully responsive cards and grids

## Sample Data Included

The application comes with 4 pre-loaded projects:
1. **Nike Summer Campaign 2026** (Onboarding)
2. **Tesla Model X Launch** (Production)
3. **Wellness Brand Identity** (Strategy)
4. **Gourmet Food Campaign** (Client Review)

Sample tasks created for Nike project to demonstrate task management.

## Automation Features

### Current Automations:
1. **Automatic Status Tracking:** Visual workflow tracker updates in real-time
2. **Role-Based Filtering:** Projects and tasks auto-filter by user role
3. **Deadline Monitoring:** System identifies and flags delayed projects
4. **Task Assignment Notifications:** Built-in toast notifications for actions

### Future Automation Ready:
- Email notifications for deadlines
- Auto-escalation for delays
- Automated status reports
- Integration with calendar systems

## Technical Stack

**Frontend:**
- React with React Router
- Tailwind CSS for styling
- Shadcn UI components
- Lucide React icons
- Sonner for notifications

**Backend:**
- FastAPI (Python)
- Motor (Async MongoDB driver)
- RESTful API design
- Pydantic models for validation

**Database:**
- MongoDB (async)
- Collections: projects, tasks, approvals

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/{id}` - Get project details
- `POST /api/projects` - Create new project
- `PATCH /api/projects/{id}` - Update project status

### Tasks
- `GET /api/tasks/project/{projectId}` - Get project tasks
- `GET /api/tasks/user/{userName}` - Get user tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/{id}` - Update task

### Approvals
- `GET /api/approvals/project/{projectId}` - Get project approvals
- `POST /api/approvals` - Request approval
- `PATCH /api/approvals/{id}` - Approve/Reject

## Next Steps

The tool is ready for you to explore! Here are suggested next actions:

1. **Test All User Roles:** Login as each role to see the different perspectives
2. **Create Your Own Project:** Use the PM account to add a real project
3. **Assign Tasks:** Practice the task assignment workflow
4. **Test Approvals:** Request and approve items
5. **Move Projects Through Stages:** Experience the full workflow

## Support & Feedback

This is your internal tool - feel free to:
- Modify workflows to match your process
- Add more project types
- Customize the dashboard KPIs
- Import your existing 150+ projects from Excel
- Add more team members and roles

---

**Built with modern web technologies for fast, reliable performance.**
**Designed specifically for advertising agency workflows.**

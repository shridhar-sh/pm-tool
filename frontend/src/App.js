import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';

import Login from '@/pages/Login';
import DashboardLayout from '@/components/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import MyDeck from '@/pages/MyDeck';
import PMDashboardNew from '@/pages/PMDashboardNew';
import AMDashboard from '@/pages/AMDashboard';
import LPDashboard from '@/pages/LPDashboard';
import TeamDashboard from '@/pages/TeamDashboard';
import TeamDirectory from '@/pages/TeamDirectory';
import ProjectDetail from '@/pages/ProjectDetail';
import HolidayManagement from '@/pages/HolidayManagement';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import PublicApproval from '@/pages/PublicApproval';
import PageErrorBoundary from '@/components/PageErrorBoundary';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Role-based access control helper
const hasAccess = (userRole, allowedRoles) => {
  return allowedRoles.includes(userRole);
};

// Protected Route Component
const ProtectedRoute = ({ user, allowedRoles, children, onLogout }) => {
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (!hasAccess(user.role, allowedRoles)) {
    return <Navigate to="/" />;
  }
  
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <PageErrorBoundary>{children}</PageErrorBoundary>
    </DashboardLayout>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // Define role permissions
  const ROLES = {
    PM: 'project_manager',
    AM: 'account_manager',
    LP: 'line_producer',
    TEAM: 'team_member'
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Public client review — outside auth + layout */}
          <Route path="/r/:token" element={<PublicApproval />} />

          <Route
            path="/login"
            element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
          />
          
          {/* Dashboard - each role sees their own dashboard */}
          <Route
            path="/"
            element={
              user ? (
                <DashboardLayout user={user} onLogout={handleLogout}>
                  <PageErrorBoundary>
                    {user.role === ROLES.PM && <Dashboard user={user} />}
                    {user.role === ROLES.AM && <AMDashboard user={user} />}
                    {user.role === ROLES.LP && <LPDashboard user={user} />}
                    {user.role === ROLES.TEAM && <TeamDashboard user={user} />}
                  </PageErrorBoundary>
                </DashboardLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          
          {/* AM Tracker - PM and AM only */}
          <Route
            path="/am-tracker"
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={[ROLES.PM, ROLES.AM]} 
                onLogout={handleLogout}
              >
                <MyDeck user={user} />
              </ProtectedRoute>
            }
          />
          
          {/* Project Management - PM and LP only */}
          <Route
            path="/project-management"
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={[ROLES.PM, ROLES.LP]} 
                onLogout={handleLogout}
              >
                <PMDashboardNew user={user} />
              </ProtectedRoute>
            }
          />
          
          {/* Timeline view - PM and LP only */}
          <Route
            path="/timelines/:id"
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={[ROLES.PM, ROLES.LP]} 
                onLogout={handleLogout}
              >
                <PMDashboardNew user={user} />
              </ProtectedRoute>
            }
          />
          
          {/* My Tasks - All roles */}
          <Route
            path="/my-tasks"
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={[ROLES.PM, ROLES.AM, ROLES.LP, ROLES.TEAM]} 
                onLogout={handleLogout}
              >
                <TeamDashboard user={user} />
              </ProtectedRoute>
            }
          />
          
          {/* Team Directory - PM only */}
          <Route
            path="/team-directory"
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={[ROLES.PM]} 
                onLogout={handleLogout}
              >
                <TeamDirectory user={user} />
              </ProtectedRoute>
            }
          />
          
          {/* Holiday Management - PM only */}
          <Route
            path="/holidays"
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={[ROLES.PM]} 
                onLogout={handleLogout}
              >
                <HolidayManagement user={user} />
              </ProtectedRoute>
            }
          />
          
          {/* Clients list & detail - PM and AM */}
          <Route
            path="/clients"
            element={
              <ProtectedRoute
                user={user}
                allowedRoles={[ROLES.PM, ROLES.AM]}
                onLogout={handleLogout}
              >
                <Clients user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients/:id"
            element={
              <ProtectedRoute
                user={user}
                allowedRoles={[ROLES.PM, ROLES.AM]}
                onLogout={handleLogout}
              >
                <ClientDetail user={user} />
              </ProtectedRoute>
            }
          />

          {/* Project Detail - All roles can view their assigned projects */}
          <Route
            path="/project/:id"
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={[ROLES.PM, ROLES.AM, ROLES.LP, ROLES.TEAM]} 
                onLogout={handleLogout}
              >
                <ProjectDetail user={user} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;

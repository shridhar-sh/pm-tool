import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';

import Login from '@/pages/Login';
import DashboardLayout from '@/components/DashboardLayout';
import PMDashboard from '@/pages/PMDashboard';
import AMDashboard from '@/pages/AMDashboard';
import LPDashboard from '@/pages/LPDashboard';
import TeamDashboard from '@/pages/TeamDashboard';
import ProjectDetail from '@/pages/ProjectDetail';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
          />
          <Route
            path="/"
            element={
              user ? (
                <DashboardLayout user={user} onLogout={handleLogout}>
                  {user.role === 'project_manager' && <PMDashboard user={user} />}
                  {user.role === 'account_manager' && <AMDashboard user={user} />}
                  {user.role === 'line_producer' && <LPDashboard user={user} />}
                  {user.role === 'team_member' && <TeamDashboard user={user} />}
                </DashboardLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/project/:id"
            element={
              user ? (
                <DashboardLayout user={user} onLogout={handleLogout}>
                  <ProjectDetail user={user} />
                </DashboardLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;

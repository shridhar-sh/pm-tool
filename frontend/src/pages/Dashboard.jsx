import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, CheckCircle, AlertCircle, Users, Briefcase, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.statusCategory !== 'closed').length,
    inProduction: projects.filter(p => p.statusCategory === 'production').length,
    completed: projects.filter(p => p.statusCategory === 'closed').length,
    pod1: projects.filter(p => p.pod === 'POD 1').length,
    pod2: projects.filter(p => p.pod === 'POD 2').length,
    pod3: projects.filter(p => p.pod === 'POD 3').length,
  };

  const kpiCards = [
    {
      title: 'Total Projects',
      value: stats.totalProjects,
      icon: Briefcase,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      link: '/am-tracker'
    },
    {
      title: 'Active Projects',
      value: stats.activeProjects,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/am-tracker'
    },
    {
      title: 'In Production',
      value: stats.inProduction,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      link: '/am-tracker'
    },
    {
      title: 'Completed',
      value: stats.completed,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      link: '/am-tracker'
    }
  ];

  const podStats = [
    { name: 'POD 1', count: stats.pod1, color: 'bg-blue-500' },
    { name: 'POD 2', count: stats.pod2, color: 'bg-purple-500' },
    { name: 'POD 3', count: stats.pod3, color: 'bg-pink-500' }
  ];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome back, {user.name}! Here's your project overview</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card
                  key={kpi.title}
                  className="border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(kpi.link)}
                  data-testid={`kpi-${kpi.title.toLowerCase().replace(' ', '-')}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">{kpi.title}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">{kpi.value}</p>
                      </div>
                      <div className={`${kpi.bgColor} p-3 rounded-lg`}>
                        <Icon className={`w-6 h-6 ${kpi.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>POD Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {podStats.map((pod) => (
                    <div key={pod.name}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">{pod.name}</span>
                        <span className="text-sm font-bold text-slate-900">{pod.count} projects</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`${pod.color} h-2 rounded-full transition-all`}
                          style={{ width: `${(pod.count / stats.totalProjects) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/am-tracker')}
                    className="w-full p-4 text-left border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    data-testid="quick-action-am-tracker"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">View AM Tracker</p>
                        <p className="text-xs text-slate-500">See all projects in table view</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/project-management')}
                    className="w-full p-4 text-left border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    data-testid="quick-action-timeline"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-50 p-2 rounded">
                        <Clock className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Project Timelines</p>
                        <p className="text-xs text-slate-500">View detailed project schedules</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/my-tasks')}
                    className="w-full p-4 text-left border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    data-testid="quick-action-tasks"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-green-50 p-2 rounded">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">My Tasks</p>
                        <p className="text-xs text-slate-500">View your assigned tasks</p>
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No projects yet. Add your first project in AM Tracker!</p>
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/timelines/${project.id}`)}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      data-testid={`recent-project-${project.id}`}
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{project.name}</p>
                        <p className="text-xs text-slate-500">{project.client} • {project.pod}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">CS: {project.csDoneBy}</p>
                        <p className="text-xs text-slate-400 capitalize">{project.statusCategory.replace('_', ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

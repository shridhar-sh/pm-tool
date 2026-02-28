import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, MapPin, Users, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LPDashboard({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`);
      const myProjects = response.data.filter(p => p.assignedLP === user.name);
      setProjects(myProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      yet_to_start: 'bg-slate-50 text-slate-700 border-slate-200',
      strategy: 'bg-blue-50 text-blue-700 border-blue-200',
      production: 'bg-amber-50 text-amber-700 border-amber-200',
      edits: 'bg-purple-50 text-purple-700 border-purple-200',
      statics: 'bg-orange-50 text-orange-700 border-orange-200',
      closed: 'bg-green-50 text-green-700 border-green-200'
    };
    return colors[status] || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const inProduction = projects.filter(p => p.statusCategory === 'production');
  const inPostProduction = projects.filter(p => p.statusCategory === 'edits');

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Line Producer Dashboard</h1>
        <p className="text-slate-600 mt-1">Manage production schedules and resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-slate-200 shadow-sm" data-testid="total-projects-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">My Projects</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{projects.length}</p>
              </div>
              <div className="bg-violet-50 p-3 rounded-lg">
                <Video className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm" data-testid="in-production-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">In Production</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{inProduction.length}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <MapPin className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm" data-testid="post-production-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Post-Production</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{inPostProduction.length}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Production Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No projects assigned yet</div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  data-testid={`project-item-${project.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-slate-900">{project.name}</h3>
                      <Badge className={`${getStatusColor(project.status)} text-xs rounded-full border`}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{project.client}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span className="mono">{new Date(project.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Phone, Mail, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AMDashboard({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`);
      const myProjects = response.data.filter(p => p.assignedAM === user.name);
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

  const needsFollowUp = projects.filter(p => 
    p.statusCategory === 'yet_to_start' || p.statusCategory === 'strategy'
  );

  const delayedProjects = projects.filter(p => {
    const deadline = new Date(p.projectEndDate);
    const today = new Date();
    return deadline < today && p.statusCategory !== 'closed';
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Account Manager Dashboard</h1>
        <p className="text-slate-600 mt-1">Track client communication and project progress</p>
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
                <Calendar className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm" data-testid="follow-up-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Needs Follow-up</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{needsFollowUp.length}</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <Phone className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm" data-testid="delayed-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Delayed</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{delayedProjects.length}</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Active Projects</CardTitle>
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
                      <Badge className={`${getStatusColor(project.statusCategory)} text-xs rounded-full border`}>
                        {(project.statusCategory || 'unknown').replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{project.client}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span className="mono">{project.projectEndDate ? new Date(project.projectEndDate).toLocaleDateString() : '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {delayedProjects.length > 0 && (
        <Card className="border border-red-200 bg-red-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Escalation Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {delayedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-white border border-red-200 rounded-lg"
                  data-testid={`delayed-project-${project.id}`}
                >
                  <div>
                    <h3 className="font-semibold text-slate-900">{project.name}</h3>
                    <p className="text-sm text-slate-600">{project.client}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => navigate(`/project/${project.id}`)}
                    data-testid={`escalate-button-${project.id}`}
                  >
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

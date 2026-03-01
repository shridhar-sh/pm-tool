import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, CheckCircle, AlertCircle, Users, Briefcase, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [team, setTeam] = useState([]);
  
  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    projectStartDate: '',
    csDoneBy: '',
    pod: 'POD 1',
    sow: '',
    assignedLP: ''
  });

  useEffect(() => {
    fetchProjects();
    fetchTeam();
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

  const fetchTeam = async () => {
    try {
      const response = await axios.get(`${API}/team-members`);
      setTeam(response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.projectStartDate || !newProject.csDoneBy) {
      toast.error('Please fill Brand Name, Start Date, and CS');
      return;
    }

    try {
      const endDate = new Date(newProject.projectStartDate);
      endDate.setDate(endDate.getDate() + 30);

      const response = await axios.post(`${API}/projects`, {
        name: newProject.name,
        client: newProject.client || newProject.name,
        sow: newProject.sow || '8 Ads - 2 creators',
        csDoneBy: newProject.csDoneBy,
        projectStartDate: newProject.projectStartDate,
        projectEndDate: endDate.toISOString().split('T')[0],
        statusCategory: 'yet_to_start',
        pod: newProject.pod,
        assignedLP: newProject.assignedLP,
        assignedAM: user.name,
        createdBy: user.name
      });

      toast.success(`✅ ${newProject.name} created!`);
      setNewProject({ name: '', client: '', projectStartDate: '', csDoneBy: '', pod: 'POD 1', sow: '', assignedAM: '' });
      setDialogOpen(false);
      fetchProjects();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to create project');
    }
  };

  const getCreativeStrategists = (selectedPod) => {
    return team.filter(t => 
      t.role === 'Creative Strategist' && 
      t.pod === selectedPod
    );
  };

  const getAccountManagers = () => {
    return team.filter(t => t.role === 'Account Manager');
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back, {user.name}! Here's your project overview</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800" data-testid="add-project-button">
              <Plus className="w-4 h-4 mr-2" />
              Add New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Quick Add Project</DialogTitle>
              <DialogDescription>Enter project details - team members from your directory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Brand Name *</Label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Urban Jungle"
                  data-testid="project-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>POD *</Label>
                  <Select value={newProject.pod} onValueChange={(value) => setNewProject({ ...newProject, pod: value, csDoneBy: '' })}>
                    <SelectTrigger data-testid="pod-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POD 1">POD 1</SelectItem>
                      <SelectItem value="POD 2">POD 2</SelectItem>
                      <SelectItem value="POD 3">POD 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={newProject.projectStartDate}
                    onChange={(e) => setNewProject({ ...newProject, projectStartDate: e.target.value })}
                    data-testid="start-date-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Creative Strategist *</Label>
                <Select value={newProject.csDoneBy} onValueChange={(value) => setNewProject({ ...newProject, csDoneBy: value })}>
                  <SelectTrigger data-testid="cs-select">
                    <SelectValue placeholder="Select CS from POD" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCreativeStrategists(newProject.pod).map(cs => (
                      <SelectItem key={cs.id} value={cs.shortName || cs.name}>
                        {cs.shortName || cs.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account Manager</Label>
                <Select value={newProject.assignedAM} onValueChange={(value) => setNewProject({ ...newProject, assignedAM: value })}>
                  <SelectTrigger data-testid="am-select">
                    <SelectValue placeholder="Select Account Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAccountManagers().map(am => (
                      <SelectItem key={am.id} value={am.shortName || am.name}>
                        {am.shortName || am.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client Name (Optional)</Label>
                <Input
                  value={newProject.client}
                  onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                  placeholder="Same as brand"
                />
              </div>
              <div className="space-y-2">
                <Label>SOW (Optional)</Label>
                <Textarea
                  value={newProject.sow}
                  onChange={(e) => setNewProject({ ...newProject, sow: e.target.value })}
                  placeholder="8 Ads - 2 creators - 6 statics"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject} className="bg-slate-900 hover:bg-slate-800" data-testid="submit-project-button">
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

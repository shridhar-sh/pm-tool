import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, Users, Clock, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PMDashboard({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    type: 'fashion',
    description: '',
    deadline: '',
    assignedAM: '',
    assignedLP: '',
    teamMembers: []
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.client || !newProject.deadline) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await axios.post(`${API}/projects`, {
        ...newProject,
        createdBy: user.name,
        status: 'onboarding'
      });
      setProjects([response.data, ...projects]);
      toast.success('Project created successfully!');
      setNewProjectOpen(false);
      setNewProject({
        name: '',
        client: '',
        type: 'fashion',
        description: '',
        deadline: '',
        assignedAM: '',
        assignedLP: '',
        teamMembers: []
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      onboarding: 'bg-violet-50 text-violet-700 border-violet-200',
      strategy: 'bg-blue-50 text-blue-700 border-blue-200',
      production: 'bg-amber-50 text-amber-700 border-amber-200',
      post_production: 'bg-purple-50 text-purple-700 border-purple-200',
      client_review: 'bg-orange-50 text-orange-700 border-orange-200',
      completed: 'bg-green-50 text-green-700 border-green-200',
      delayed: 'bg-red-50 text-red-700 border-red-200'
    };
    return colors[status] || colors.onboarding;
  };

  const getProjectImage = (type) => {
    const images = {
      fashion: 'https://images.unsplash.com/photo-1713425886063-4a49da507ada?w=400&h=300&fit=crop',
      tech: 'https://images.unsplash.com/photo-1741720928049-2d167982b981?w=400&h=300&fit=crop',
      lifestyle: 'https://images.pexels.com/photos/8038334/pexels-photo-8038334.jpeg?w=400&h=300&fit=crop',
      food: 'https://images.unsplash.com/photo-1713425886063-4a49da507ada?w=400&h=300&fit=crop'
    };
    return images[type] || images.fashion;
  };

  const kpiData = [
    {
      title: 'Active Projects',
      value: projects.filter(p => p.status !== 'completed').length,
      icon: TrendingUp,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50'
    },
    {
      title: 'In Production',
      value: projects.filter(p => p.status === 'production').length,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Pending Review',
      value: projects.filter(p => p.status === 'client_review').length,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Completed',
      value: projects.filter(p => p.status === 'completed').length,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ];

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Agency Overview</h1>
          <p className="text-slate-600 mt-1">Manage all projects and team resources</p>
        </div>
        <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800" data-testid="create-project-button">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>Add a new project to the workflow</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name *</Label>
                  <Input
                    id="project-name"
                    placeholder="Summer Campaign 2026"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    data-testid="project-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name *</Label>
                  <Input
                    id="client-name"
                    placeholder="Nike"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                    data-testid="client-name-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-type">Project Type</Label>
                  <Select value={newProject.type} onValueChange={(value) => setNewProject({ ...newProject, type: value })}>
                    <SelectTrigger data-testid="project-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="tech">Tech</SelectItem>
                      <SelectItem value="lifestyle">Lifestyle</SelectItem>
                      <SelectItem value="food">Food & Beverage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline *</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={newProject.deadline}
                    onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                    data-testid="deadline-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Project details and requirements..."
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  data-testid="description-input"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned-am">Account Manager</Label>
                  <Input
                    id="assigned-am"
                    placeholder="Michael Chen"
                    value={newProject.assignedAM}
                    onChange={(e) => setNewProject({ ...newProject, assignedAM: e.target.value })}
                    data-testid="assigned-am-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned-lp">Line Producer</Label>
                  <Input
                    id="assigned-lp"
                    placeholder="Emma Davis"
                    value={newProject.assignedLP}
                    onChange={(e) => setNewProject({ ...newProject, assignedLP: e.target.value })}
                    data-testid="assigned-lp-input"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewProjectOpen(false)} data-testid="cancel-button">
                Cancel
              </Button>
              <Button onClick={handleCreateProject} className="bg-slate-900 hover:bg-slate-800" data-testid="save-project-button">
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className="kpi-card border border-slate-200 shadow-sm" data-testid={`kpi-${kpi.title.toLowerCase().replace(' ', '-')}`}>
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

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search projects by name or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-projects-input"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No projects found. Create your first project!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="project-card cursor-pointer border border-slate-200 shadow-sm hover:shadow-md"
                onClick={() => navigate(`/project/${project.id}`)}
                data-testid={`project-card-${project.id}`}
              >
                <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                  <img
                    src={getProjectImage(project.type)}
                    alt={project.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 text-base">{project.name}</h3>
                    <Badge className={`${getStatusColor(project.status)} text-xs rounded-full border`}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{project.client}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span className="mono">{new Date(project.deadline).toLocaleDateString()}</span>
                    </div>
                    {project.assignedAM && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{project.assignedAM}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

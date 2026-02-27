import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, List, LayoutGrid, Calendar as CalendarIcon, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import ProjectTimeline from '@/components/ProjectTimeline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PMDashboardNew({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('timeline');
  const [selectedProject, setSelectedProject] = useState(null);

  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    sow: '',
    csDoneBy: '',
    projectStartDate: '',
    projectEndDate: '',
    statusCategory: 'strategy',
    assignedAM: '',
    assignedLP: '',
    pod: 'POD 1'
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`);
      setProjects(response.data);
      if (response.data.length > 0 && !selectedProject) {
        setSelectedProject(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.client || !newProject.projectStartDate || !newProject.projectEndDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await axios.post(`${API}/projects`, {
        ...newProject,
        createdBy: user.name
      });
      setProjects([response.data, ...projects]);
      setSelectedProject(response.data);
      toast.success('Project created successfully!');
      setNewProjectOpen(false);
      setNewProject({
        name: '',
        client: '',
        sow: '',
        csDoneBy: '',
        projectStartDate: '',
        projectEndDate: '',
        statusCategory: 'strategy',
        assignedAM: '',
        assignedLP: '',
        pod: 'POD 1'
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const handleProjectUpdate = async (projectId, updates) => {
    try {
      await axios.patch(`${API}/projects/${projectId}`, updates);
      const updatedProjects = projects.map(p => 
        p.id === projectId ? { ...p, ...updates } : p
      );
      setProjects(updatedProjects);
      setSelectedProject(updatedProjects.find(p => p.id === projectId));
      toast.success('Project updated');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Project Management</h1>
          <p className="text-slate-600 mt-1">Track projects with timeline view</p>
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
              <DialogDescription>Add a new project with timeline tracking</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name *</Label>
                  <Input
                    id="project-name"
                    placeholder="Urban Jungle (Feb 2026)"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    data-testid="project-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name *</Label>
                  <Input
                    id="client-name"
                    placeholder="Urban Jungle"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                    data-testid="client-name-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sow">Scope of Work (SOW)</Label>
                <Textarea
                  id="sow"
                  placeholder="8 Ads - 2 creators - 6 statics..." 
                  value={newProject.sow}
                  onChange={(e) => setNewProject({ ...newProject, sow: e.target.value })}
                  data-testid="sow-input"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cs-done-by">CS Done By</Label>
                  <Input
                    id="cs-done-by"
                    placeholder="Deep"
                    value={newProject.csDoneBy}
                    onChange={(e) => setNewProject({ ...newProject, csDoneBy: e.target.value })}
                    data-testid="cs-done-by-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pod">POD</Label>
                  <Select value={newProject.pod} onValueChange={(value) => setNewProject({ ...newProject, pod: value })}>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Project Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newProject.projectStartDate}
                    onChange={(e) => setNewProject({ ...newProject, projectStartDate: e.target.value })}
                    data-testid="start-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">Project End Date *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newProject.projectEndDate}
                    onChange={(e) => setNewProject({ ...newProject, projectEndDate: e.target.value })}
                    data-testid="end-date-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-category">Status Category</Label>
                <Select value={newProject.statusCategory} onValueChange={(value) => setNewProject({ ...newProject, statusCategory: value })}>
                  <SelectTrigger data-testid="status-category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yet_to_start">Yet to Start</SelectItem>
                    <SelectItem value="strategy">Strategy</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="edits">Edits</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="statics">Statics</SelectItem>
                  </SelectContent>
                </Select>
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

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-projects-input"
          />
        </div>
        <Tabs value={currentView} onValueChange={setCurrentView}>
          <TabsList>
            <TabsTrigger value="timeline" data-testid="timeline-view-tab">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="list" data-testid="list-view-tab">
              <List className="w-4 h-4 mr-2" />
              List
            </TabsTrigger>
            <TabsTrigger value="kanban" data-testid="kanban-view-tab">
              <LayoutGrid className="w-4 h-4 mr-2" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="overall" data-testid="overall-view-tab">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overall
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No projects found. Create your first project!</p>
        </div>
      ) : (
        <div>
          {currentView === 'timeline' && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {filteredProjects.map((project) => (
                  <Button
                    key={project.id}
                    variant={selectedProject?.id === project.id ? 'default' : 'outline'}
                    onClick={() => setSelectedProject(project)}
                    className={selectedProject?.id === project.id ? 'bg-slate-900' : ''}
                    data-testid={`select-project-${project.id}`}
                  >
                    {project.name}
                  </Button>
                ))}
              </div>
              {selectedProject && (
                <ProjectTimeline
                  project={selectedProject}
                  onUpdate={(updates) => handleProjectUpdate(selectedProject.id, updates)}
                />
              )}
            </div>
          )}
          
          {currentView === 'list' && (
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-slate-500 text-center py-8">List view coming soon...</p>
              </CardContent>
            </Card>
          )}
          
          {currentView === 'kanban' && (
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-slate-500 text-center py-8">Kanban view coming soon...</p>
              </CardContent>
            </Card>
          )}
          
          {currentView === 'overall' && (
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-slate-500 text-center py-8">Overall view coming soon...</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

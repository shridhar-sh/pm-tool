import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MyDeck({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [team, setTeam] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [quickAdd, setQuickAdd] = useState({
    name: '',
    client: '',
    projectStartDate: '',
    csDoneBy: '',
    pod: 'POD 1',
    sow: '',
    assignedAM: ''
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

  const handleEditProject = async () => {
    if (!editingProject.name || !editingProject.csDoneBy) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      await axios.patch(`${API}/projects/${editingProject.id}`, {
        name: editingProject.name,
        client: editingProject.client,
        sow: editingProject.sow,
        csDoneBy: editingProject.csDoneBy,
        pod: editingProject.pod,
        assignedLP: editingProject.assignedLP,
        projectStartDate: editingProject.projectStartDate,
        projectEndDate: editingProject.projectEndDate
      });

      toast.success('Project updated!');
      setEditDialogOpen(false);
      fetchProjects();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update project');
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

  const handleQuickAdd = async () => {
    if (!quickAdd.name || !quickAdd.projectStartDate || !quickAdd.csDoneBy) {
      toast.error('Please fill Brand Name, Start Date, and CS');
      return;
    }

    try {
      const endDate = new Date(quickAdd.projectStartDate);
      endDate.setDate(endDate.getDate() + 30);

      const response = await axios.post(`${API}/projects`, {
        name: quickAdd.name,
        client: quickAdd.client || quickAdd.name,
        sow: quickAdd.sow || '8 Ads - 2 creators',
        csDoneBy: quickAdd.csDoneBy,
        projectStartDate: quickAdd.projectStartDate,
        projectEndDate: endDate.toISOString().split('T')[0],
        statusCategory: 'yet_to_start',
        pod: quickAdd.pod,
        assignedAM: quickAdd.assignedAM || user.name,
        createdBy: user.name
      });

      setProjects([response.data, ...projects]);
      toast.success(`✅ ${quickAdd.name} added to deck!`);
      setQuickAdd({ name: '', client: '', projectStartDate: '', csDoneBy: '', pod: 'POD 1', sow: '', assignedAM: '' });
      setShowQuickAdd(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to add project');
    }
  };

  const handleStageToggle = async (projectId, stageIndex, completed) => {
    try {
      const project = projects.find(p => p.id === projectId);
      const updatedStages = [...project.workflowStages];
      updatedStages[stageIndex].completed = completed;

      // Auto-calculate status based on the LAST completed stage
      let newStatus = 'yet_to_start';
      
      // Define stage groups
      const stageGroups = {
        'yet_to_start': ['Onboarding Form', 'Onboarding'],
        'strategy': ['Products', 'Research', 'Brainstorm Session', 'Scripts', 'Scripts Approval'],
        'pre_production': ['Model brief to LP', 'Internal KT Production', 'Storyboarding', 'Model list to client', 'Model Approval'],
        'production': ['PPM', 'Shoot'],
        'post_production': ['Internal KT Post', 'Edits', 'Feedback'],
        'correction_ongoing': ['Revision'],
        'closed': ['Project Closed']
      };

      // Find the last completed stage
      let lastCompletedStage = null;
      for (let i = updatedStages.length - 1; i >= 0; i--) {
        if (updatedStages[i].completed) {
          lastCompletedStage = updatedStages[i].name;
          break;
        }
      }

      // Determine status based on last completed stage
      if (lastCompletedStage) {
        for (const [status, stages] of Object.entries(stageGroups)) {
          if (stages.includes(lastCompletedStage)) {
            newStatus = status;
            break;
          }
        }
      }

      await axios.patch(`${API}/projects/${projectId}`, {
        workflowStages: updatedStages,
        statusCategory: newStatus
      });

      setProjects(projects.map(p =>
        p.id === projectId ? { ...p, workflowStages: updatedStages, statusCategory: newStatus } : p
      ));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const groupedProjects = {};
  ['POD 1', 'POD 2', 'POD 3'].forEach(pod => {
    groupedProjects[pod] = {
      yet_to_start: projects.filter(p => p.pod === pod && p.statusCategory === 'yet_to_start'),
      strategy: projects.filter(p => p.pod === pod && p.statusCategory === 'strategy'),
      pre_production: projects.filter(p => p.pod === pod && p.statusCategory === 'pre_production'),
      production: projects.filter(p => p.pod === pod && p.statusCategory === 'production'),
      post_production: projects.filter(p => p.pod === pod && p.statusCategory === 'post_production'),
      correction_ongoing: projects.filter(p => p.pod === pod && p.statusCategory === 'correction_ongoing'),
      closed: projects.filter(p => p.pod === pod && p.statusCategory === 'closed')
    };
  });

  const stages = [
    // Strategy Phase
    { name: 'Onboarding Form', department: 'strategy' },
    { name: 'Onboarding', department: 'strategy' },
    { name: 'Products', department: 'strategy' },
    { name: 'Research', department: 'strategy' },
    { name: 'Brainstorm Session', department: 'strategy' },
    // Pre-Production Phase
    { name: 'Scripts', department: 'pre_production' },
    { name: 'Scripts Approval', department: 'pre_production' },
    { name: 'Model brief to LP', department: 'pre_production' },
    { name: 'Internal KT Production', department: 'pre_production' },
    { name: 'Storyboarding', department: 'pre_production' },
    // Production Phase
    { name: 'Model list to client', department: 'production' },
    { name: 'Model Approval', department: 'production' },
    { name: 'PPM', department: 'production' },
    { name: 'Shoot', department: 'production' },
    // Post-Production Phase
    { name: 'Internal KT Post', department: 'post_production' },
    { name: 'Edits', department: 'post_production' },
    { name: 'Feedback', department: 'post_production' },
    { name: 'Revision', department: 'post_production' },
    { name: 'Project Closed', department: 'post_production' }
  ];

  const departmentLabels = {
    strategy: 'Strategy',
    pre_production: 'Pre-Production',
    production: 'Production',
    post_production: 'Post-Production'
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">My Deck</h1>
          <p className="text-slate-600 mt-1">Project management tracker - All projects in one place</p>
        </div>
        <Button
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className="bg-slate-900 hover:bg-slate-800"
          data-testid="quick-add-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Quick Add Project
        </Button>
      </div>

      {showQuickAdd && (
        <Card className="border-2 border-slate-900">
          <CardHeader>
            <CardTitle>Quick Add - Enter Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Brand Name *</Label>
                <Input
                  value={quickAdd.name}
                  onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                  placeholder="Urban Jungle"
                  data-testid="quick-add-name"
                />
              </div>
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={quickAdd.projectStartDate}
                  onChange={(e) => setQuickAdd({ ...quickAdd, projectStartDate: e.target.value })}
                  data-testid="quick-add-date"
                />
              </div>
              <div>
                <Label>POD</Label>
                <Select value={quickAdd.pod} onValueChange={(value) => setQuickAdd({ ...quickAdd, pod: value, csDoneBy: '' })}>
                  <SelectTrigger data-testid="quick-add-pod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POD 1">POD 1</SelectItem>
                    <SelectItem value="POD 2">POD 2</SelectItem>
                    <SelectItem value="POD 3">POD 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CS (Creative Strategist) *</Label>
                <Select value={quickAdd.csDoneBy} onValueChange={(value) => setQuickAdd({ ...quickAdd, csDoneBy: value })}>
                  <SelectTrigger data-testid="quick-add-cs">
                    <SelectValue placeholder="Select CS" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCreativeStrategists(quickAdd.pod).map(cs => (
                      <SelectItem key={cs.id} value={cs.shortName || cs.name}>
                        {cs.shortName || cs.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account Manager</Label>
                <Select value={quickAdd.assignedAM} onValueChange={(value) => setQuickAdd({ ...quickAdd, assignedAM: value })}>
                  <SelectTrigger data-testid="quick-add-am">
                    <SelectValue placeholder="Select AM" />
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
              <div>
                <Label>Client Name (Optional)</Label>
                <Input
                  value={quickAdd.client}
                  onChange={(e) => setQuickAdd({ ...quickAdd, client: e.target.value })}
                  placeholder="Same as brand"
                />
              </div>
              <div>
                <Label>SOW (Optional)</Label>
                <Input
                  value={quickAdd.sow}
                  onChange={(e) => setQuickAdd({ ...quickAdd, sow: e.target.value })}
                  placeholder="8 Ads - 2 creators"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleQuickAdd} className="bg-slate-900" data-testid="submit-quick-add">
                ✅ Add to Deck
              </Button>
              <Button variant="outline" onClick={() => setShowQuickAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-800 text-white z-10">
              <tr>
                <th className="border border-slate-600 p-3 text-left min-w-[200px] font-semibold">Project Name</th>
                <th className="border border-slate-600 p-3 text-left min-w-[200px] font-semibold">SOW</th>
                <th className="border border-slate-600 p-3 text-left min-w-[100px] font-semibold">CS</th>
                <th className="border border-slate-600 p-3 text-center min-w-[80px] bg-red-600 font-semibold">Ext Days</th>
                <th className="border border-slate-600 p-3 text-left min-w-[120px] font-semibold">Status</th>
                {stages.map((stage, idx) => {
                  const prevDept = idx > 0 ? stages[idx - 1].department : null;
                  const isNewDept = stage.department !== prevDept;
                  return (
                    <th 
                      key={idx} 
                      className={`border border-slate-600 p-2 min-w-[40px] text-center font-medium ${
                        isNewDept ? 'border-l-4 border-l-white' : ''
                      }`}
                      title={stage.name}
                    >
                      <div className="text-[10px] leading-tight whitespace-nowrap">
                        {stage.name.length > 8 ? stage.name.substring(0, 8) + '..' : stage.name}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedProjects).map(([pod, statusGroups], podIndex) => (
                <React.Fragment key={pod}>
                  {/* White gap before POD (except first) */}
                  {podIndex > 0 && (
                    <tr>
                      <td colSpan={5 + stages.length} className="bg-white h-6"></td>
                    </tr>
                  )}
                  <tr className="bg-slate-800 text-white">
                    <td colSpan={5 + stages.length} className="p-3 font-bold text-lg">
                      {pod}
                    </td>
                  </tr>
                  {Object.entries(statusGroups).map(([status, projectList]) => (
                    projectList.length > 0 && (
                      <React.Fragment key={status}>
                        <tr className="bg-slate-600 text-white">
                          <td colSpan={5 + stages.length} className="p-2 font-semibold capitalize">
                            {status.replace('_', ' ')}
                          </td>
                        </tr>
                        {projectList.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50">
                            <td className="border border-slate-200 p-2 bg-blue-100">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigate(`/timelines/${project.id}`)}
                                  className="text-left font-medium text-blue-900 hover:underline flex-1"
                                  data-testid={`project-link-${project.id}`}
                                >
                                  {project.name}
                                </button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingProject(project);
                                    setEditDialogOpen(true);
                                  }}
                                  className="text-blue-700 hover:bg-blue-200"
                                  data-testid={`edit-project-${project.id}`}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="border border-slate-200 p-2 bg-blue-50 text-xs">
                              {project.sow}
                            </td>
                            <td className="border border-slate-200 p-2 bg-orange-100">
                              {project.csDoneBy}
                            </td>
                            <td className="border border-slate-200 p-2 text-center bg-red-100 font-bold">
                              {project.extraDays || 0}
                            </td>
                            <td className="border border-slate-200 p-2 bg-slate-700 text-white text-xs">
                              {project.statusCategory.replace('_', ' ')}
                            </td>
                            {project.workflowStages.map((stage, stageIdx) => (
                              <td key={stageIdx} className="border border-slate-200 p-2 text-center bg-blue-50">
                                <Checkbox
                                  checked={stage.completed}
                                  onCheckedChange={(checked) => handleStageToggle(project.id, stageIdx, checked)}
                                  data-testid={`checkbox-${project.id}-${stageIdx}`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500">Loading projects...</div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Brand Name *</Label>
                <Input
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>POD *</Label>
                  <Select value={editingProject.pod} onValueChange={(value) => setEditingProject({ ...editingProject, pod: value })}>
                    <SelectTrigger>
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
                  <Label>Creative Strategist *</Label>
                  <Select value={editingProject.csDoneBy} onValueChange={(value) => setEditingProject({ ...editingProject, csDoneBy: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getCreativeStrategists(editingProject.pod).map(cs => (
                        <SelectItem key={cs.id} value={cs.shortName || cs.name}>
                          {cs.shortName || cs.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Line Producer</Label>
                <Select value={editingProject.assignedLP || ''} onValueChange={(value) => setEditingProject({ ...editingProject, assignedLP: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select LP" />
                  </SelectTrigger>
                  <SelectContent>
                    {getLineProducers().map(lp => (
                      <SelectItem key={lp.id} value={lp.shortName || lp.name}>
                        {lp.shortName || lp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={editingProject.projectStartDate}
                    onChange={(e) => setEditingProject({ ...editingProject, projectStartDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={editingProject.projectEndDate}
                    onChange={(e) => setEditingProject({ ...editingProject, projectEndDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  value={editingProject.client}
                  onChange={(e) => setEditingProject({ ...editingProject, client: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SOW</Label>
                <Textarea
                  value={editingProject.sow}
                  onChange={(e) => setEditingProject({ ...editingProject, sow: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProject} className="bg-slate-900 hover:bg-slate-800">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

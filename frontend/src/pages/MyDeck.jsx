import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, Calendar, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MyDeck({ user }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [quickAdd, setQuickAdd] = useState({
    name: '',
    client: '',
    projectStartDate: '',
    csDoneBy: '',
    pod: 'POD 1',
    sow: ''
  });

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
        createdBy: user.name
      });

      setProjects([response.data, ...projects]);
      toast.success(`✅ ${quickAdd.name} added to deck!`);
      setQuickAdd({ name: '', client: '', projectStartDate: '', csDoneBy: '', pod: 'POD 1', sow: '' });
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

      // Auto-calculate status based on stages
      let newStatus = 'yet_to_start';
      const stageNames = updatedStages.map(s => s.name);
      const completedStages = updatedStages.filter(s => s.completed).map(s => s.name);

      if (completedStages.includes('Project Closed')) {
        newStatus = 'closed';
      } else if (completedStages.some(s => ['Edits', 'Feedback', 'Revision'].includes(s))) {
        newStatus = 'edits';
      } else if (completedStages.some(s => ['Shoot', 'PPM', 'Model Approval'].includes(s))) {
        newStatus = 'production';
      } else if (completedStages.some(s => ['Scripts', 'Storyboarding', 'Pre Production'].includes(s))) {
        newStatus = 'production';
      } else if (completedStages.some(s => ['Onboarding', 'Products', 'Research', 'Brainstorm Session'].includes(s))) {
        newStatus = 'strategy';
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
      production: projects.filter(p => p.pod === pod && p.statusCategory === 'production'),
      edits: projects.filter(p => p.pod === pod && p.statusCategory === 'edits'),
      closed: projects.filter(p => p.pod === pod && p.statusCategory === 'closed'),
      statics: projects.filter(p => p.pod === pod && p.statusCategory === 'statics')
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <Label>CS (Creative Strategist) *</Label>
                <Input
                  value={quickAdd.csDoneBy}
                  onChange={(e) => setQuickAdd({ ...quickAdd, csDoneBy: e.target.value })}
                  placeholder="Deep"
                  data-testid="quick-add-cs"
                />
              </div>
              <div>
                <Label>POD</Label>
                <Select value={quickAdd.pod} onValueChange={(value) => setQuickAdd({ ...quickAdd, pod: value })}>
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
                <th className="border border-slate-300 p-2 text-left min-w-[200px]">Project Name</th>
                <th className="border border-slate-300 p-2 text-left min-w-[200px]">SOW</th>
                <th className="border border-slate-300 p-2 text-left min-w-[120px]">CS done by</th>
                <th className="border border-slate-300 p-2 text-center min-w-[80px] bg-red-600">no of ext days</th>
                <th className="border border-slate-300 p-2 text-left min-w-[150px]">Status</th>
                {stages.map((stage, idx) => {
                  const prevDept = idx > 0 ? stages[idx - 1].department : null;
                  const isNewDept = stage.department !== prevDept;
                  return (
                    <th 
                      key={idx} 
                      className={`border border-slate-300 p-2 min-w-[50px] text-center ${
                        isNewDept ? 'border-l-4 border-l-slate-900' : ''
                      }`}
                    >
                      <div className="transform -rotate-45 origin-center whitespace-nowrap text-xs">
                        {stage.name}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedProjects).map(([pod, statusGroups]) => (
                <React.Fragment key={pod}>
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
                              <button
                                onClick={() => navigate(`/timelines/${project.id}`)}
                                className="text-left font-medium text-blue-900 hover:underline"
                                data-testid={`project-link-${project.id}`}
                              >
                                {project.name}
                              </button>
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
    </div>
  );
}

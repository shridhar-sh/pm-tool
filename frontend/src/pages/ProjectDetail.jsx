import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Users, Clock, CheckCircle, Circle, AlertCircle, Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProjectDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium'
  });

  const [newApproval, setNewApproval] = useState({
    type: 'internal',
    title: '',
    description: '',
    approver: ''
  });

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, tasksRes, approvalsRes] = await Promise.all([
        axios.get(`${API}/projects/${id}`),
        axios.get(`${API}/tasks/project/${id}`),
        axios.get(`${API}/approvals/project/${id}`)
      ]);
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setApprovals(approvalsRes.data);
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assignedTo || !newTask.dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await axios.post(`${API}/tasks`, {
        ...newTask,
        projectId: id,
        projectName: project.name,
        createdBy: user.name,
        completed: false
      });
      setTasks([...tasks, response.data]);
      toast.success('Task created successfully!');
      setTaskDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: '',
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };

  const handleCreateApproval = async () => {
    if (!newApproval.title || !newApproval.approver) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await axios.post(`${API}/approvals`, {
        ...newApproval,
        projectId: id,
        status: 'pending',
        requestedBy: user.name
      });
      setApprovals([...approvals, response.data]);
      toast.success('Approval request created!');
      setApprovalDialogOpen(false);
      setNewApproval({
        type: 'internal',
        title: '',
        description: '',
        approver: ''
      });
    } catch (error) {
      console.error('Error creating approval:', error);
      toast.error('Failed to create approval request');
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      await axios.patch(`${API}/projects/${id}`, { status: newStatus });
      setProject({ ...project, status: newStatus });
      toast.success('Project status updated!');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleApprovalAction = async (approvalId, action) => {
    try {
      await axios.patch(`${API}/approvals/${approvalId}`, {
        status: action,
        reviewedBy: user.name,
        reviewedAt: new Date().toISOString()
      });
      setApprovals(
        approvals.map(a =>
          a.id === approvalId ? { ...a, status: action, reviewedBy: user.name } : a
        )
      );
      toast.success(`Approval ${action}!`);
    } catch (error) {
      console.error('Error updating approval:', error);
      toast.error('Failed to update approval');
    }
  };

  const workflowStages = [
    { name: 'Onboarding', value: 'onboarding', color: 'text-violet-600' },
    { name: 'Strategy', value: 'strategy', color: 'text-blue-600' },
    { name: 'Production', value: 'production', color: 'text-amber-600' },
    { name: 'Post-Production', value: 'post_production', color: 'text-purple-600' },
    { name: 'Client Review', value: 'client_review', color: 'text-orange-600' },
    { name: 'Completed', value: 'completed', color: 'text-green-600' }
  ];

  const getCurrentStageIndex = () => {
    return workflowStages.findIndex(s => s.value === project?.status);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      approved: 'bg-green-50 text-green-700 border-green-200',
      rejected: 'bg-red-50 text-red-700 border-red-200'
    };
    return colors[status] || colors.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Project not found</div>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          data-testid="back-button"
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-slate-600 mt-1">{project.client}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span className="mono">{new Date(project.deadline).toLocaleDateString()}</span>
              </div>
              {project.assignedAM && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>AM: {project.assignedAM}</span>
                </div>
              )}
              {project.assignedLP && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>LP: {project.assignedLP}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Project Workflow</h3>
          <div className="flex items-center justify-between">
            {workflowStages.map((stage, index) => {
              const isActive = index === currentStageIndex;
              const isCompleted = index < currentStageIndex;
              return (
                <div key={stage.value} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCompleted
                          ? 'bg-green-500 border-green-500'
                          : isActive
                          ? 'bg-slate-900 border-slate-900'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : isActive ? (
                        <Circle className="w-5 h-5 text-white fill-current" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <p
                      className={`text-xs mt-2 text-center font-medium ${
                        isActive ? stage.color : 'text-slate-500'
                      }`}
                    >
                      {stage.name}
                    </p>
                  </div>
                  {index < workflowStages.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        index < currentStageIndex ? 'bg-green-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {user.role === 'project_manager' && (
          <div className="mt-6 flex gap-2 flex-wrap">
            {workflowStages.map((stage) => (
              <Button
                key={stage.value}
                size="sm"
                variant={project.status === stage.value ? 'default' : 'outline'}
                onClick={() => handleUpdateStatus(stage.value)}
                data-testid={`status-button-${stage.value}`}
                className={project.status === stage.value ? 'bg-slate-900 hover:bg-slate-800' : ''}
              >
                Move to {stage.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="tasks" data-testid="tasks-tab">Tasks</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="approvals-tab">Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Project Tasks</CardTitle>
              {(user.role === 'project_manager' || user.role === 'account_manager') && (
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-slate-900 hover:bg-slate-800" data-testid="add-task-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>Assign a task to a team member</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-title">Task Title *</Label>
                        <Input
                          id="task-title"
                          placeholder="Design social media assets"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          data-testid="task-title-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-description">Description</Label>
                        <Textarea
                          id="task-description"
                          placeholder="Task details..."
                          value={newTask.description}
                          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                          data-testid="task-description-input"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="assigned-to">Assigned To *</Label>
                          <Input
                            id="assigned-to"
                            placeholder="Team member name"
                            value={newTask.assignedTo}
                            onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                            data-testid="assigned-to-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="due-date">Due Date *</Label>
                          <Input
                            id="due-date"
                            type="date"
                            value={newTask.dueDate}
                            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                            data-testid="due-date-input"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                          <SelectTrigger data-testid="priority-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTaskDialogOpen(false)} data-testid="cancel-task-button">
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTask} className="bg-slate-900 hover:bg-slate-800" data-testid="save-task-button">
                        Create Task
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No tasks yet</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
                      data-testid={`task-item-${task.id}`}
                    >
                      <div className="flex-1">
                        <h4 className={`font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span>Assigned to: {task.assignedTo}</span>
                          <span className="mono">{new Date(task.dueDate).toLocaleDateString()}</span>
                          <Badge className={`${
                            task.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                            task.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-50 text-slate-700 border-slate-200'
                          } text-xs rounded-full border`}>
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                      {task.completed && (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Approval Queue</CardTitle>
              {(user.role === 'project_manager' || user.role === 'account_manager') && (
                <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-slate-900 hover:bg-slate-800" data-testid="request-approval-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Request Approval
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Approval</DialogTitle>
                      <DialogDescription>Submit for internal or client approval</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="approval-type">Approval Type</Label>
                        <Select value={newApproval.type} onValueChange={(value) => setNewApproval({ ...newApproval, type: value })}>
                          <SelectTrigger data-testid="approval-type-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internal">Internal</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="approval-title">Title *</Label>
                        <Input
                          id="approval-title"
                          placeholder="Final video review"
                          value={newApproval.title}
                          onChange={(e) => setNewApproval({ ...newApproval, title: e.target.value })}
                          data-testid="approval-title-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="approval-description">Description</Label>
                        <Textarea
                          id="approval-description"
                          placeholder="What needs approval..."
                          value={newApproval.description}
                          onChange={(e) => setNewApproval({ ...newApproval, description: e.target.value })}
                          data-testid="approval-description-input"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="approver">Approver *</Label>
                        <Input
                          id="approver"
                          placeholder="Approver name"
                          value={newApproval.approver}
                          onChange={(e) => setNewApproval({ ...newApproval, approver: e.target.value })}
                          data-testid="approver-input"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setApprovalDialogOpen(false)} data-testid="cancel-approval-button">
                        Cancel
                      </Button>
                      <Button onClick={handleCreateApproval} className="bg-slate-900 hover:bg-slate-800" data-testid="save-approval-button">
                        Request Approval
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {approvals.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No approvals pending</div>
              ) : (
                <div className="space-y-3">
                  {approvals.map((approval) => (
                    <div
                      key={approval.id}
                      className="flex items-start justify-between p-4 border border-slate-200 rounded-lg"
                      data-testid={`approval-item-${approval.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">{approval.title}</h4>
                          <Badge className={`${
                            approval.type === 'client' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          } text-xs rounded-full border`}>
                            {approval.type}
                          </Badge>
                          <Badge className={`${getStatusColor(approval.status)} text-xs rounded-full border`}>
                            {approval.status}
                          </Badge>
                        </div>
                        {approval.description && (
                          <p className="text-sm text-slate-600 mt-1">{approval.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span>Approver: {approval.approver}</span>
                          <span>Requested by: {approval.requestedBy}</span>
                        </div>
                      </div>
                      {approval.status === 'pending' && approval.approver === user.name && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprovalAction(approval.id, 'approved')}
                            data-testid={`approve-button-${approval.id}`}
                            className="text-green-600 border-green-200 hover:bg-green-50"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprovalAction(approval.id, 'rejected')}
                            data-testid={`reject-button-${approval.id}`}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

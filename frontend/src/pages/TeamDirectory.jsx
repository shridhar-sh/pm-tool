import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamDirectory({ user }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    employeeId: '',
    name: '',
    shortName: '',
    role: '',
    department: '',
    pod: ''
  });

  const [editingShortName, setEditingShortName] = useState(null);
  const [tempShortName, setTempShortName] = useState('');

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const response = await axios.get(`${API}/team-members`);
      setTeam(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.employeeId || !newMember.name || !newMember.role || !newMember.department) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await axios.post(`${API}/team-members/bulk`, {
        members: [{
          employeeId: newMember.employeeId,
          name: newMember.name,
          shortName: newMember.shortName || null,
          role: newMember.role,
          department: newMember.department,
          pod: newMember.pod || null
        }]
      });
      
      toast.success(`${newMember.name} added to team!`);
      setNewMember({ employeeId: '', name: '', shortName: '', role: '', department: '', pod: '' });
      setDialogOpen(false);
      fetchTeam();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to add team member');
    }
  };

  const handleUpdateShortName = async (memberId) => {
    try {
      await axios.patch(`${API}/team-members/${memberId}`, {
        shortName: tempShortName
      });
      toast.success('Short name updated!');
      setEditingShortName(null);
      fetchTeam();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update');
    }
  };

  const handleDeleteMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/team-members/${memberId}`);
      toast.success(`${memberName} removed from team`);
      fetchTeam();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to remove team member');
    }
  };

  const groupedTeam = {
    Management: team.filter(t => t.department === 'Management'),
    'Heads of Departments': team.filter(t => t.department === 'Heads of Departments'),
    'Operations Team': team.filter(t => t.department === 'Operations Team'),
    'POD 1': team.filter(t => t.pod === 'POD 1'),
    'POD 2': team.filter(t => t.pod === 'POD 2'),
    'POD 3': team.filter(t => t.pod === 'POD 3')
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Team Directory</h1>
          <p className="text-slate-600 mt-1">All team members organized by department and POD</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800" data-testid="add-employee-button">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>Add a new team member to the directory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="emp-id">Employee ID *</Label>
                <Input
                  id="emp-id"
                  placeholder="EF-052"
                  value={newMember.employeeId}
                  onChange={(e) => setNewMember({ ...newMember, employeeId: e.target.value })}
                  data-testid="employee-id-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-name">Full Name *</Label>
                <Input
                  id="emp-name"
                  placeholder="John Doe"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  data-testid="employee-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-short">Short Name *</Label>
                <Input
                  id="emp-short"
                  placeholder="John (used in dropdowns)"
                  value={newMember.shortName}
                  onChange={(e) => setNewMember({ ...newMember, shortName: e.target.value })}
                  data-testid="employee-short-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-role">Role *</Label>
                <Input
                  id="emp-role"
                  placeholder="Creative Strategist"
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  data-testid="employee-role-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-dept">Department *</Label>
                <Select value={newMember.department} onValueChange={(value) => setNewMember({ ...newMember, department: value })}>
                  <SelectTrigger data-testid="employee-dept-select">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Management">Management</SelectItem>
                    <SelectItem value="Heads of Departments">Heads of Departments</SelectItem>
                    <SelectItem value="Operations Team">Operations Team</SelectItem>
                    <SelectItem value="Strategy Team">Strategy Team</SelectItem>
                    <SelectItem value="Production Team">Production Team</SelectItem>
                    <SelectItem value="Post Production Team">Post Production Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-pod">POD (Optional)</Label>
                <Select value={newMember.pod} onValueChange={(value) => setNewMember({ ...newMember, pod: value })}>
                  <SelectTrigger data-testid="employee-pod-select">
                    <SelectValue placeholder="Select POD" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="POD 1">POD 1</SelectItem>
                    <SelectItem value="POD 2">POD 2</SelectItem>
                    <SelectItem value="POD 3">POD 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember} className="bg-slate-900 hover:bg-slate-800" data-testid="submit-employee-button">
                Add Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTeam).map(([group, members]) => (
            members.length > 0 && (
              <Card key={group} className="border border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-800 text-white">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {group} ({members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-200 p-3 text-left">Employee ID</th>
                        <th className="border border-slate-200 p-3 text-left">Name</th>
                        <th className="border border-slate-200 p-3 text-left">Short Name</th>
                        <th className="border border-slate-200 p-3 text-left">Role</th>
                        <th className="border border-slate-200 p-3 text-left">Department</th>
                        <th className="border border-slate-200 p-3 text-center w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member, idx) => (
                        <tr key={member.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="border border-slate-200 p-3 font-mono text-xs">{member.employeeId}</td>
                          <td className="border border-slate-200 p-3 font-semibold">{member.name}</td>
                          <td className="border border-slate-200 p-3">
                            {editingShortName === member.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={tempShortName}
                                  onChange={(e) => setTempShortName(e.target.value)}
                                  className="h-8"
                                  placeholder="Short name"
                                />
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateShortName(member.id)}>
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingShortName(null)}>
                                  <X className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600">{member.shortName || '-'}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingShortName(member.id);
                                    setTempShortName(member.shortName || '');
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="border border-slate-200 p-3">{member.role}</td>
                          <td className="border border-slate-200 p-3 text-slate-600">{member.department}</td>
                          <td className="border border-slate-200 p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMember(member.id, member.name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              data-testid={`delete-${member.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  );
}

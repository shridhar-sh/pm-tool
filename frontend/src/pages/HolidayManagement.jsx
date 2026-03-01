import { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import axios from 'axios';
import { toast } from 'sonner';
import { format, parseISO, getDay } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HolidayManagement({ user }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: ''
  });

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const response = await axios.get(`${API}/holidays`);
      // Sort by date
      const sorted = response.data.sort((a, b) => new Date(a.date) - new Date(b.date));
      setHolidays(sorted);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const getDayOfWeek = (dateStr) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = parseISO(dateStr);
    return days[getDay(date)];
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await axios.post(`${API}/holidays`, {
        date: newHoliday.date,
        name: newHoliday.name,
        dayOfWeek: getDayOfWeek(newHoliday.date)
      });
      
      toast.success(`${newHoliday.name} added!`);
      setNewHoliday({ date: '', name: '' });
      setDialogOpen(false);
      fetchHolidays();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to add holiday');
    }
  };

  const handleEditHoliday = async () => {
    if (!editingHoliday.date || !editingHoliday.name) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await axios.patch(`${API}/holidays/${editingHoliday.id}`, {
        date: editingHoliday.date,
        name: editingHoliday.name,
        dayOfWeek: getDayOfWeek(editingHoliday.date)
      });
      
      toast.success('Holiday updated!');
      setEditDialogOpen(false);
      setEditingHoliday(null);
      fetchHolidays();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId, holidayName) => {
    if (!window.confirm(`Are you sure you want to delete "${holidayName}"?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/holidays/${holidayId}`);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete holiday');
    }
  };

  const handleToggleWorking = async (holiday) => {
    try {
      await axios.patch(`${API}/holidays/${holiday.id}`, {
        isWorking: !holiday.isWorking
      });
      toast.success(holiday.isWorking ? 'Marked as holiday' : 'Marked as working day');
      fetchHolidays();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update');
    }
  };

  // Group holidays by month
  const groupByMonth = (holidays) => {
    const groups = {};
    holidays.forEach(h => {
      const month = format(parseISO(h.date), 'MMMM yyyy');
      if (!groups[month]) groups[month] = [];
      groups[month].push(h);
    });
    return groups;
  };

  const groupedHolidays = groupByMonth(holidays);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="holiday-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Holiday Management</h1>
          <p className="text-slate-600 mt-1">Manage company holidays and working days</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-slate-900 hover:bg-slate-800" data-testid="add-holiday-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Holiday
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{holidays.length}</p>
                <p className="text-sm text-slate-600">Total Holidays</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{holidays.filter(h => h.isWorking).length}</p>
                <p className="text-sm text-slate-600">Marked as Working</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <X className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{holidays.filter(h => !h.isWorking).length}</p>
                <p className="text-sm text-slate-600">Non-Working Holidays</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holiday List by Month */}
      <div className="space-y-6">
        {Object.entries(groupedHolidays).map(([month, monthHolidays]) => (
          <Card key={month} className="border border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-800 text-white py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {month} ({monthHolidays.length} holidays)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-200 p-3 text-left w-32">Date</th>
                    <th className="border border-slate-200 p-3 text-left">Holiday Name</th>
                    <th className="border border-slate-200 p-3 text-center w-24">Day</th>
                    <th className="border border-slate-200 p-3 text-center w-32">Working?</th>
                    <th className="border border-slate-200 p-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthHolidays.map((holiday, idx) => (
                    <tr key={holiday.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="border border-slate-200 p-3 font-mono text-xs">
                        {format(parseISO(holiday.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="border border-slate-200 p-3 font-semibold">{holiday.name}</td>
                      <td className="border border-slate-200 p-3 text-center">
                        <Badge className={`text-xs ${
                          holiday.dayOfWeek === 'Sat' || holiday.dayOfWeek === 'Sun'
                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {holiday.dayOfWeek}
                        </Badge>
                      </td>
                      <td className="border border-slate-200 p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={holiday.isWorking}
                            onCheckedChange={() => handleToggleWorking(holiday)}
                          />
                          <span className={`text-xs ${holiday.isWorking ? 'text-green-600' : 'text-red-600'}`}>
                            {holiday.isWorking ? 'Yes (C)' : 'No'}
                          </span>
                        </div>
                      </td>
                      <td className="border border-slate-200 p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingHoliday(holiday);
                              setEditDialogOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteHoliday(holiday.id, holiday.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Holiday Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Holiday</DialogTitle>
            <DialogDescription>Add a company holiday to the calendar</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                data-testid="holiday-date-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Holiday Name *</Label>
              <Input
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="e.g. Diwali"
                data-testid="holiday-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddHoliday} className="bg-slate-900 hover:bg-slate-800" data-testid="submit-holiday-btn">
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Holiday Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Holiday</DialogTitle>
            <DialogDescription>Update holiday details</DialogDescription>
          </DialogHeader>
          {editingHoliday && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={editingHoliday.date}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Holiday Name *</Label>
                <Input
                  value={editingHoliday.name}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, name: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditHoliday} className="bg-slate-900 hover:bg-slate-800">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

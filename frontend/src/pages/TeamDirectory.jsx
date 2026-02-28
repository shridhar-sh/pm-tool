import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamDirectory({ user }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Team Directory</h1>
        <p className="text-slate-600 mt-1">All team members organized by department and POD</p>
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
                        <th className="border border-slate-200 p-3 text-left">Role</th>
                        <th className="border border-slate-200 p-3 text-left">Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member, idx) => (
                        <tr key={member.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="border border-slate-200 p-3 font-mono text-xs">{member.employeeId}</td>
                          <td className="border border-slate-200 p-3 font-semibold">{member.name}</td>
                          <td className="border border-slate-200 p-3">{member.role}</td>
                          <td className="border border-slate-200 p-3 text-slate-600">{member.department}</td>
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

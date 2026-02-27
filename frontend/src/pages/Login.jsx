import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const demoUsers = [
      {
        email: 'pm@agency.com',
        password: 'demo123',
        role: 'project_manager',
        name: 'Sarah Johnson',
        avatar: 'https://images.unsplash.com/photo-1731848358154-52ebc3c4d590?w=100&h=100&fit=crop'
      },
      {
        email: 'am@agency.com',
        password: 'demo123',
        role: 'account_manager',
        name: 'Michael Chen',
        avatar: 'https://images.unsplash.com/photo-1622676614630-a9109126264a?w=100&h=100&fit=crop'
      },
      {
        email: 'lp@agency.com',
        password: 'demo123',
        role: 'line_producer',
        name: 'Emma Davis',
        avatar: 'https://images.unsplash.com/photo-1758613655736-16757bdd953b?w=100&h=100&fit=crop'
      },
      {
        email: 'team@agency.com',
        password: 'demo123',
        role: 'team_member',
        name: 'Alex Rivera',
        avatar: 'https://images.unsplash.com/photo-1731848358154-52ebc3c4d590?w=100&h=100&fit=crop'
      }
    ];

    const user = demoUsers.find(u => u.email === email && u.password === password);
    
    if (user) {
      toast.success('Welcome back!');
      onLogin(user);
    } else {
      toast.error('Invalid credentials. Try demo accounts.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md border border-slate-200 shadow-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">AgencyPM</CardTitle>
            <CardDescription className="text-slate-600 mt-2">
              Sign in to your workspace
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="pm@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="demo123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800"
              data-testid="login-submit-button"
            >
              Sign In
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Demo Accounts:</p>
            <div className="text-xs space-y-1 text-slate-600">
              <p><span className="font-mono">pm@agency.com</span> - Project Manager</p>
              <p><span className="font-mono">am@agency.com</span> - Account Manager</p>
              <p><span className="font-mono">lp@agency.com</span> - Line Producer</p>
              <p><span className="font-mono">team@agency.com</span> - Team Member</p>
              <p className="mt-2 text-slate-500">Password: <span className="font-mono">demo123</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

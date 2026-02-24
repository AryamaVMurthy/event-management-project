// Login: Module level logic for the feature area.
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Login: Runs Login flow. Inputs: none. Returns: a function result.
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  // Get Dashboard Route: Maps authenticated user role to the correct landing dashboard route. Inputs: role. Returns: a Promise with payload data.
  const getDashboardRoute = (role) => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "organizer") return "/organizer/dashboard";
    return "/dashboard";
  };

  // Handle Submit: Validates local state and sends form values to the configured API action. Inputs: e. Returns: side effects and response to caller.
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('All fields required');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      navigate(getDashboardRoute(result.user.role));
    } else {
      setError(result.message);
    }
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && <p>{error}</p>}

            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" variant="outline">Login</Button>
          </form>
        </CardContent>
        <CardFooter>
          <p>Don't have account?</p>
          <Separator orientation="vertical" />
          <Button asChild variant="outline">
            <Link to="/register">Register</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

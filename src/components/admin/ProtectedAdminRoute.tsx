import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface ProtectedAdminRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'moderator';
}

const ProtectedAdminRoute = ({ children, requiredRole = 'admin' }: ProtectedAdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isModerator, loading: roleLoading } = useAdminAuth();

  // Show loading state
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to home
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Check role requirements
  const hasAccess = requiredRole === 'admin' ? isAdmin : isModerator;

  // No access - show access denied
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access the admin panel. 
            Please contact an administrator if you believe this is an error.
          </p>
          <Button asChild>
            <Link to="/">Return to App</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;

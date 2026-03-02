import React from 'react';
import { Navigate } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

const Auth: React.FC = () => {
  const { user, loading } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to home if already signed in
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[400px] h-[400px] -top-[100px] -left-[100px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute w-[300px] h-[300px] top-1/2 right-0 rounded-full bg-cyan/10 blur-[80px]" />
        <div className="absolute w-[350px] h-[350px] bottom-0 left-1/3 rounded-full bg-primary/5 blur-[90px]" />
      </div>
      
      <GlassCard className="w-full max-w-md p-0">
        <AuthForm />
      </GlassCard>
    </div>
  );
};

export default Auth;

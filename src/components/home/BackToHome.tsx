import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackToHomeProps {
  className?: string;
}

export const BackToHome: React.FC<BackToHomeProps> = ({ className }) => {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      asChild 
      className={`gap-1.5 text-muted-foreground hover:text-foreground ${className}`}
    >
      <Link to="/">
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>
    </Button>
  );
};

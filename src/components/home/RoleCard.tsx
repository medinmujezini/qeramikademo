import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RoleCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  ctaText: string;
  to: string;
  variant?: 'primary' | 'secondary';
}

export const RoleCard: React.FC<RoleCardProps> = ({
  icon: Icon,
  title,
  subtitle,
  description,
  features,
  ctaText,
  to,
  variant = 'primary',
}) => {
  return (
    <Card className="relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-500 group">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.08)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.06)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.04)_0%,transparent_70%)]" />
      
      {/* Thin gold accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      
      <CardContent className="relative z-10 p-8 pt-10">
        {/* Subtitle label */}
        <p className="text-[10px] uppercase tracking-[0.25em] text-primary/70 mb-4">{subtitle}</p>
        
        {/* Icon + Title */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-10 h-10 rounded-none border border-primary/20 bg-primary/5 flex items-center justify-center text-primary/80">
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-display font-semibold text-foreground tracking-tight">{title}</h2>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-light">
          {description}
        </p>

        {/* Features */}
        <ul className="space-y-2.5 mb-8">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-foreground/80">
              <span className="w-4 h-px bg-primary/50" />
              {feature}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button asChild variant="outline" size="lg" className="w-full border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 tracking-wider text-xs uppercase group-hover:border-primary/60 transition-all duration-500">
          <Link to={to} className="flex items-center justify-center gap-2">
            {ctaText}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

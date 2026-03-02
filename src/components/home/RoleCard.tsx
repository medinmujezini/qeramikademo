import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';

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
    <GlassCard 
      className={`
        group relative overflow-hidden transition-all duration-500 glass-shine-sweep
        hover:scale-[1.02] hover:shadow-2xl
        ${variant === 'primary' 
          ? 'hover:shadow-primary/20 border-primary/20' 
          : 'hover:shadow-accent/20 border-accent/20'
        }
      `}
      variant="premium"
      showOrbs
    >
      {/* Shine sweep layer */}
      <div className="shine-layer" />
      
      {/* Gradient overlay on hover */}
      <div className={`
        absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
        ${variant === 'primary'
          ? 'bg-gradient-to-br from-primary/5 to-transparent'
          : 'bg-gradient-to-br from-accent/5 to-transparent'
        }
      `} />
      
      <GlassCardContent className="relative z-10 p-8">
        {/* Icon */}
        <div className={`
          w-16 h-16 rounded-2xl flex items-center justify-center mb-6
          ${variant === 'primary'
            ? 'bg-primary/10 text-primary'
            : 'bg-accent/10 text-accent'
          }
        `}>
          <Icon className="w-8 h-8" />
        </div>

        {/* Title & Subtitle */}
        <div className="mb-4">
          <p className={`
            text-sm font-medium uppercase tracking-wider mb-1
            ${variant === 'primary' ? 'text-primary' : 'text-accent'}
          `}>
            {subtitle}
          </p>
          <h3 className="text-2xl font-bold text-foreground">
            {title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-muted-foreground mb-6 leading-relaxed">
          {description}
        </p>

        {/* Features */}
        <ul className="space-y-3 mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className={`
                w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                ${variant === 'primary' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}
              `}>
                <Check className="w-3 h-3" />
              </div>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button 
          asChild 
          className={`
            w-full font-semibold
            ${variant === 'primary' ? 'btn-glow' : ''}
          `}
          variant={variant === 'primary' ? 'default' : 'outline'}
          size="lg"
        >
          <Link to={to}>{ctaText}</Link>
        </Button>
      </GlassCardContent>
    </GlassCard>
  );
};

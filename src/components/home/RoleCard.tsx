import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, Check } from 'lucide-react';
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
    <Card className={`
      transition-all duration-200
      hover:shadow-lg hover:border-primary/30
      ${variant === 'primary' ? 'border-primary/20' : ''}
    `}>
      <CardContent className="p-6">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
          <Icon className="w-6 h-6 text-primary" />
        </div>

        {/* Title & Subtitle */}
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {subtitle}
          </p>
          <h3 className="text-xl font-bold text-foreground">
            {title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {description}
        </p>

        {/* Features */}
        <ul className="space-y-2 mb-6">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Check className="w-2.5 h-2.5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button asChild className="w-full" variant="default" size="lg">
          <Link to={to}>{ctaText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

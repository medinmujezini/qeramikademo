import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "premium" | "simple";
  tint?: "default" | "primary" | "success" | "danger" | "warning";
  size?: "sm" | "md" | "lg" | "pill";
  showOrbs?: boolean;
  showShine?: boolean;
  showCaustics?: boolean;
}

const tintClasses = {
  default: "",
  primary: "glass-primary",
  success: "glass-success",
  danger: "glass-danger",
  warning: "glass-warning",
};

const sizeClasses = {
  sm: "glass-sm",
  md: "glass-card",
  lg: "glass-lg",
  pill: "glass-pill",
};

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      variant = "premium",
      tint = "default",
      size = "md",
      showOrbs = true,
      showShine = true,
      showCaustics = false,
      children,
      ...props
    },
    ref
  ) => {
    if (variant === "simple") {
      return (
        <div ref={ref} className={cn("glass", sizeClasses[size], className)} {...props}>
          {children}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "glass",
          sizeClasses[size],
          tintClasses[tint],
          showShine && "glass-shine",
          showCaustics && "glass-caustics",
          className
        )}
        {...props}
      >
        {/* Animated gradient orbs */}
        {showOrbs && (
          <div className="gradient-orbs">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
GlassCardHeader.displayName = "GlassCardHeader";

const GlassCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
GlassCardTitle.displayName = "GlassCardTitle";

const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
GlassCardDescription.displayName = "GlassCardDescription";

const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
GlassCardContent.displayName = "GlassCardContent";

const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
GlassCardFooter.displayName = "GlassCardFooter";

export {
  GlassCard,
  GlassCardHeader,
  GlassCardFooter,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
};

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-xs font-light uppercase tracking-[0.15em] ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(38_60%_78%/0.3)] hover:shadow-[inset_0_1px_0_hsl(38_60%_78%/0.3),0_0_20px_hsl(38_60%_68%/0.2)] hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-[0_0_15px_hsl(0_60%_50%/0.2)]",
        outline:
          "border border-primary/20 bg-transparent text-primary/80 hover:bg-primary/5 hover:border-primary/40 hover:text-primary",
        secondary:
          "bg-primary/8 text-primary hover:bg-primary/12",
        ghost: "hover:bg-primary/5 hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        glow: "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(38_60%_68%/0.25)] hover:shadow-[0_0_40px_hsl(38_60%_68%/0.4)] hover:bg-primary/90",
        luxury: "bg-transparent border border-primary/25 text-primary hover:bg-primary/5 hover:border-primary/50 hover:shadow-[inset_0_0_20px_hsl(38_60%_68%/0.06),0_0_25px_hsl(38_60%_68%/0.12)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 tracking-widest",
        lg: "h-10 px-8 tracking-[0.2em]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

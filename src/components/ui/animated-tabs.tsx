import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

interface TabIndicatorPosition {
  width: number;
  left: number;
}

interface AnimatedTabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  value: string;
}

const AnimatedTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  AnimatedTabsListProps
>(({ className, value, children, ...props }, ref) => {
  const [indicatorPos, setIndicatorPos] = useState<TabIndicatorPosition>({ width: 0, left: 0 });
  const [isReady, setIsReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const updateIndicator = () => {
    if (!listRef.current) return;
    
    const activeTab = listRef.current.querySelector(`[data-state="active"]`) as HTMLElement;
    if (activeTab) {
      const listRect = listRef.current.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      
      setIndicatorPos({
        width: tabRect.width,
        left: tabRect.left - listRect.left,
      });
      setIsReady(true);
    }
  };

  useLayoutEffect(() => {
    updateIndicator();
  }, [value]);

  useEffect(() => {
    // Initial position after mount
    const timer = setTimeout(updateIndicator, 50);
    
    // Update on resize
    const handleResize = () => updateIndicator();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "relative inline-flex h-11 items-center gap-1 rounded-full p-1",
        "glass glass-shine-sweep",
        className
      )}
      {...props}
    >
      {/* Animated glass indicator pill */}
      <div
        className={cn(
          "absolute h-9 rounded-full",
          "bg-gradient-to-br from-primary/30 to-primary/10",
          "backdrop-blur-md border border-white/20",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_2px_12px_-2px_rgba(59,130,246,0.4)]",
          "transition-all duration-300 ease-out",
          !isReady && "opacity-0"
        )}
        style={{
          width: indicatorPos.width,
          left: indicatorPos.left,
        }}
      >
        {/* Shine sweep animation */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div 
            className="absolute inset-0 -translate-x-full animate-[tab-shine_0.6s_ease-out_forwards]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            }}
          />
        </div>
      </div>
      
      {/* Tab triggers */}
      <div className="relative z-10 flex items-center gap-1">
        {children}
      </div>
    </TabsPrimitive.List>
  );
});
AnimatedTabsList.displayName = 'AnimatedTabsList';

const AnimatedTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 px-4 py-2",
      "text-sm font-medium rounded-full",
      "text-muted-foreground/80 hover:text-foreground",
      "transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
      "data-[state=active]:text-primary data-[state=active]:font-semibold",
      "whitespace-nowrap",
      className
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Trigger>
));
AnimatedTabsTrigger.displayName = 'AnimatedTabsTrigger';

export { AnimatedTabsList, AnimatedTabsTrigger };

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, GripVertical, Minus } from 'lucide-react';

type PanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface FloatingPanelProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  position?: PanelPosition;
  draggable?: boolean;
  width?: string;
  maxHeight?: string;
  className?: string;
  headerClassName?: string;
  icon?: React.ReactNode;
  /** When true, panel collapses to just icon button */
  minimizable?: boolean;
}

const POSITION_CLASSES: Record<PanelPosition, string> = {
  'top-left': 'panel-zone-tl-offset',
  'top-right': 'panel-zone-tr-offset',
  'bottom-left': 'panel-zone-bl',
  'bottom-right': 'panel-zone-br',
};

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  title,
  children,
  defaultCollapsed = false,
  position = 'top-left',
  draggable = false,
  width = 'w-64',
  maxHeight = 'max-h-[360px]',
  className,
  headerClassName,
  icon,
  minimizable = false,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [minimized, setMinimized] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      posX: offset.x,
      posY: offset.y,
    });
  }, [draggable, offset]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      // Constrain to viewport with 80px margin
      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - 80;
      
      const newX = Math.max(-maxX, Math.min(maxX, dragStart.posX + deltaX));
      const newY = Math.max(-80, Math.min(maxY, dragStart.posY + deltaY));
      
      setOffset({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const positionClass = POSITION_CLASSES[position];

  // Minimized state - just a small button
  if (minimized && minimizable) {
    return (
      <div
        className={cn(
          "floating-panel glass-control p-2",
          positionClass,
          className
        )}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setMinimized(false)}
          title={title}
        >
          {icon || <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "floating-panel glass-floating",
        positionClass,
        collapsed ? "w-auto" : width,
        !collapsed && maxHeight,
        isDragging && "cursor-grabbing shadow-2xl z-30",
        className
      )}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      {/* Header */}
      <div 
        className={cn(
          "panel-header shrink-0",
          draggable && "cursor-grab",
          isDragging && "cursor-grabbing",
          headerClassName
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 min-w-0">
          {draggable && !collapsed && (
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          )}
          
          {icon && (
            <span className="shrink-0 text-muted-foreground">{icon}</span>
          )}
          
          {!collapsed && (
            <span className="panel-header-title truncate">{title}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {minimizable && !collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                setMinimized(true);
              }}
            >
              <Minus className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
          >
            {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      
      {/* Content with collapse animation */}
      <div 
        className={cn(
          "transition-all duration-200 ease-out overflow-hidden",
          collapsed ? "h-0 opacity-0" : "opacity-100 flex-1"
        )}
      >
        <ScrollArea className="h-full">
          <div className="p-3">
            {children}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

// Compact control card - for small info displays
interface ControlCardProps {
  children: React.ReactNode;
  position?: PanelPosition;
  className?: string;
}

export const ControlCard: React.FC<ControlCardProps> = ({
  children,
  position = 'bottom-left',
  className,
}) => {
  const positionClass = POSITION_CLASSES[position];
  
  return (
    <div className={cn("floating-panel glass-control p-3", positionClass, className)}>
      {children}
    </div>
  );
};

// Simple floating toolbar - horizontal pill
interface FloatingToolbarProps {
  children: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  children,
  className,
  position = 'top',
}) => {
  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 z-10",
        position === 'top' ? 'top-4' : 'bottom-4',
        "glass-toolbar flex items-center gap-2",
        className
      )}
    >
      {children}
    </div>
  );
};

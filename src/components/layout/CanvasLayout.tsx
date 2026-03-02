/**
 * CanvasLayout - Consistent layout wrapper for canvas-based tabs
 * 
 * Provides consistent panel positioning with:
 * - Full-bleed canvas area
 * - Corner-anchored floating panels (24px from edges)
 * - Centered toolbars (top/bottom)
 * - Proper z-index layering
 */

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CanvasLayoutProps {
  /** The main canvas content (fills entire container) */
  canvas: React.ReactNode;
  /** Top-center toolbar */
  toolbar?: React.ReactNode;
  /** Top-left panel content */
  topLeft?: React.ReactNode;
  topLeftClassName?: string;
  /** Top-right panel content */
  topRight?: React.ReactNode;
  topRightClassName?: string;
  /** Bottom-left panel/card */
  bottomLeft?: React.ReactNode;
  bottomLeftClassName?: string;
  /** Bottom-right panel/card */
  bottomRight?: React.ReactNode;
  bottomRightClassName?: string;
  /** Bottom-center hint/toolbar */
  bottomCenter?: React.ReactNode;
  /** Optional left full-height panel (for PlumbingTab style) */
  leftPanel?: React.ReactNode;
  leftPanelClassName?: string;
  /** Container className */
  className?: string;
}

/**
 * Panel wrapper with glass styling and scroll support
 */
interface PanelWrapperProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  hasScroll?: boolean;
  variant?: 'floating' | 'control';
}

const PanelWrapper: React.FC<PanelWrapperProps> = ({
  children,
  title,
  className,
  hasScroll = true,
  variant = 'floating'
}) => {
  const baseClass = variant === 'floating' ? 'glass-floating' : 'glass-control';
  
  return (
    <div className={cn(baseClass, 'rounded-xl overflow-hidden flex flex-col', className)}>
      {title && (
        <div className="panel-header shrink-0">
          <span className="panel-header-title">{title}</span>
        </div>
      )}
      {hasScroll ? (
        <ScrollArea className="flex-1">
          <div className="p-3">
            {children}
          </div>
        </ScrollArea>
      ) : (
        <div className="p-3">
          {children}
        </div>
      )}
    </div>
  );
};

export const CanvasLayout: React.FC<CanvasLayoutProps> = ({
  canvas,
  toolbar,
  topLeft,
  topLeftClassName,
  topRight,
  topRightClassName,
  bottomLeft,
  bottomLeftClassName,
  bottomRight,
  bottomRightClassName,
  bottomCenter,
  leftPanel,
  leftPanelClassName,
  className,
}) => {
  // Standard offsets (Tailwind units: 6 = 24px, 20 = 80px for below toolbar)
  const toolbarOffset = 'top-20'; // 80px - below toolbar
  const edgeInset = '6'; // 24px from edges
  
  return (
    <div className={cn('h-full relative overflow-hidden', className)}>
      {/* FULL-BLEED CANVAS */}
      <div className="absolute inset-0 z-0">
        {canvas}
      </div>
      
      {/* TOP CENTER TOOLBAR */}
      {toolbar && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          {toolbar}
        </div>
      )}
      
      {/* LEFT FULL-HEIGHT PANEL (alternative to topLeft) */}
      {leftPanel && (
        <div className={cn(
          'absolute top-20 left-6 bottom-6 z-20',
          'w-72 flex flex-col',
          leftPanelClassName
        )}>
          <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
            <ScrollArea className="flex-1">
              {leftPanel}
            </ScrollArea>
          </div>
        </div>
      )}
      
      {/* TOP LEFT PANEL */}
      {topLeft && !leftPanel && (
        <div className={cn(
          `absolute ${toolbarOffset} left-${edgeInset} z-20`,
          'w-56 max-h-[calc(100%-140px)]',
          topLeftClassName
        )}>
          {topLeft}
        </div>
      )}
      
      {/* TOP RIGHT PANEL */}
      {topRight && (
        <div className={cn(
          `absolute ${toolbarOffset} right-${edgeInset} z-20`,
          'w-64 max-h-[calc(100%-140px)]',
          topRightClassName
        )}>
          {topRight}
        </div>
      )}
      
      {/* BOTTOM LEFT */}
      {bottomLeft && (
        <div className={cn(
          `absolute bottom-${edgeInset} left-${edgeInset} z-20`,
          bottomLeftClassName
        )}>
          {bottomLeft}
        </div>
      )}
      
      {/* BOTTOM RIGHT */}
      {bottomRight && (
        <div className={cn(
          `absolute bottom-${edgeInset} right-${edgeInset} z-20`,
          bottomRightClassName
        )}>
          {bottomRight}
        </div>
      )}
      
      {/* BOTTOM CENTER */}
      {bottomCenter && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          {bottomCenter}
        </div>
      )}
    </div>
  );
};

// Export panel wrapper for reuse
export { PanelWrapper };

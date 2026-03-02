/**
 * Clash Visualization Overlay
 * 
 * Renders clash markers on the MEP canvas to highlight
 * collisions and clearance violations.
 */

import React from 'react';
import type { MEPClash } from '@/types/mep';

interface ClashVisualizationProps {
  clashes: MEPClash[];
  transform: { x: number; y: number; scale: number };
  showLabels?: boolean;
}

/**
 * Draw clash markers on a 2D canvas context
 */
export function drawClashMarkers(
  ctx: CanvasRenderingContext2D,
  clashes: MEPClash[],
  scale: number
): void {
  for (const clash of clashes) {
    const radius = clash.type === 'hard' ? 15 : 10;
    const color = clash.severity === 'critical' ? '#EF4444' : 
                  clash.severity === 'warning' ? '#F59E0B' : '#3B82F6';
    
    // Draw pulsing circle
    ctx.save();
    ctx.translate(clash.position.x, clash.position.y);
    
    // Outer glow
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = `${color}33`;
    ctx.fill();
    
    // Main circle
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = `${color}88`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
    
    // X mark for hard clashes
    if (clash.type === 'hard') {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.lineTo(5, 5);
      ctx.moveTo(5, -5);
      ctx.lineTo(-5, 5);
      ctx.stroke();
    } else {
      // Warning triangle for soft clashes
      ctx.fillStyle = 'white';
      ctx.font = `bold ${12 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 0);
    }
    
    ctx.restore();
  }
}

/**
 * React component for SVG-based clash overlay (alternative to canvas)
 */
export const ClashVisualizationOverlay: React.FC<ClashVisualizationProps> = ({
  clashes,
  transform,
  showLabels = false,
}) => {
  if (clashes.length === 0) return null;
  
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
        {clashes.map((clash) => {
          const radius = clash.type === 'hard' ? 15 : 10;
          const color = clash.severity === 'critical' ? '#EF4444' : 
                        clash.severity === 'warning' ? '#F59E0B' : '#3B82F6';
          
          return (
            <g key={clash.id} transform={`translate(${clash.position.x}, ${clash.position.y})`}>
              {/* Outer glow */}
              <circle
                r={radius + 5}
                fill={`${color}33`}
              />
              
              {/* Main circle */}
              <circle
                r={radius}
                fill={`${color}88`}
                stroke={color}
                strokeWidth={2 / transform.scale}
              />
              
              {/* Icon */}
              {clash.type === 'hard' ? (
                <g stroke="white" strokeWidth={2 / transform.scale}>
                  <line x1={-5} y1={-5} x2={5} y2={5} />
                  <line x1={5} y1={-5} x2={-5} y2={5} />
                </g>
              ) : (
                <text
                  fill="white"
                  fontSize={12 / transform.scale}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontWeight="bold"
                >
                  !
                </text>
              )}
              
              {/* Label */}
              {showLabels && (
                <text
                  y={radius + 10}
                  fill={color}
                  fontSize={10 / transform.scale}
                  textAnchor="middle"
                >
                  {clash.severity}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default ClashVisualizationOverlay;

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, GitBranch, HelpCircle } from 'lucide-react';
import { CutOptimizationResult } from '@/utils/tileCalculator';
import { Wall } from '@/types/floorPlan';

interface LeftoverFlowDiagramProps {
  optimization: CutOptimizationResult;
  walls: Wall[];
}

interface WallNode {
  id: string;
  name: string;
  index: number;
  x: number;
  y: number;
  cutsCount: number;
  receivesFrom: string[];
  sendsTo: string[];
  internalReuse: number;
}

interface FlowConnection {
  from: string;
  to: string;
  count: number;
  fromNode?: WallNode;
  toNode?: WallNode;
}

export const LeftoverFlowDiagram: React.FC<LeftoverFlowDiagramProps> = ({ 
  optimization, 
  walls 
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<FlowConnection | null>(null);

  // Build flow data from optimization results
  const flowData = useMemo(() => {
    const crossWallReuses = optimization.reusedPieces.filter(r => r.isCrossWall);
    
    // Count connections between walls
    const connectionMap: Map<string, Map<string, number>> = new Map();
    const internalReuseMap: Map<string, number> = new Map();
    
    optimization.reusedPieces.forEach(reuse => {
      const sourceWall = reuse.leftoverPiece.sourceWallId;
      const destWall = reuse.usedForCut.wallId || '';
      
      if (reuse.isCrossWall && sourceWall && destWall) {
        if (!connectionMap.has(sourceWall)) {
          connectionMap.set(sourceWall, new Map());
        }
        const current = connectionMap.get(sourceWall)!.get(destWall) || 0;
        connectionMap.get(sourceWall)!.set(destWall, current + 1);
      } else if (sourceWall) {
        const current = internalReuseMap.get(sourceWall) || 0;
        internalReuseMap.set(sourceWall, current + 1);
      }
    });

    // Get involved walls (those with cross-wall connections)
    const involvedWallIds = new Set<string>();
    crossWallReuses.forEach(r => {
      if (r.leftoverPiece.sourceWallId) involvedWallIds.add(r.leftoverPiece.sourceWallId);
      if (r.usedForCut.wallId) involvedWallIds.add(r.usedForCut.wallId);
    });

    // Create nodes for involved walls
    const nodes: WallNode[] = [];
    const wallsArray = Array.from(involvedWallIds);
    
    // Calculate positions in a circle or line based on count
    const nodeCount = wallsArray.length;
    const svgWidth = 320;
    const svgHeight = 180;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    const radius = Math.min(svgWidth, svgHeight) * 0.35;

    wallsArray.forEach((wallId, i) => {
      const wallIndex = walls.findIndex(w => w.id === wallId);
      const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
      
      let x, y;
      if (nodeCount <= 2) {
        // Linear layout for 2 or fewer nodes
        x = centerX + (i - (nodeCount - 1) / 2) * 100;
        y = centerY;
      } else {
        // Circular layout
        x = centerX + radius * Math.cos(angle);
        y = centerY + radius * Math.sin(angle);
      }

      const receivesFrom: string[] = [];
      const sendsTo: string[] = [];
      
      connectionMap.forEach((destMap, fromId) => {
        if (destMap.has(wallId)) {
          receivesFrom.push(fromId);
        }
      });
      
      connectionMap.get(wallId)?.forEach((_, toId) => {
        sendsTo.push(toId);
      });

      nodes.push({
        id: wallId,
        name: `Wall ${String.fromCharCode(65 + wallIndex)}`,
        index: wallIndex,
        x,
        y,
        cutsCount: optimization.reusedPieces.filter(r => 
          r.leftoverPiece.sourceWallId === wallId || r.usedForCut.wallId === wallId
        ).length,
        receivesFrom,
        sendsTo,
        internalReuse: internalReuseMap.get(wallId) || 0
      });
    });

    // Create connections
    const connections: FlowConnection[] = [];
    connectionMap.forEach((destMap, fromId) => {
      destMap.forEach((count, toId) => {
        const fromNode = nodes.find(n => n.id === fromId);
        const toNode = nodes.find(n => n.id === toId);
        connections.push({
          from: fromId,
          to: toId,
          count,
          fromNode,
          toNode
        });
      });
    });

    return { nodes, connections, crossWallCount: crossWallReuses.length };
  }, [optimization, walls]);

  // Don't render if no cross-wall reuses
  if (flowData.crossWallCount === 0) {
    return null;
  }

  const nodeRadius = 28;

  // Calculate arrow path with curve
  const getArrowPath = (conn: FlowConnection) => {
    if (!conn.fromNode || !conn.toNode) return '';
    
    const { fromNode, toNode } = conn;
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize direction
    const nx = dx / dist;
    const ny = dy / dist;
    
    // Start and end points (offset by node radius)
    const startX = fromNode.x + nx * nodeRadius;
    const startY = fromNode.y + ny * nodeRadius;
    const endX = toNode.x - nx * (nodeRadius + 8); // Extra space for arrow
    const endY = toNode.y - ny * (nodeRadius + 8);
    
    // Curve control point (perpendicular offset)
    const midX = (startX + endX) / 2 - ny * 15;
    const midY = (startY + endY) / 2 + nx * 15;
    
    return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
  };

  const isConnectionHighlighted = (conn: FlowConnection) => {
    if (hoveredConnection) {
      return hoveredConnection.from === conn.from && hoveredConnection.to === conn.to;
    }
    if (hoveredNode) {
      return conn.from === hoveredNode || conn.to === hoveredNode;
    }
    return false;
  };

  const isNodeHighlighted = (node: WallNode) => {
    if (hoveredNode) return hoveredNode === node.id;
    if (hoveredConnection) {
      return hoveredConnection.from === node.id || hoveredConnection.to === node.id;
    }
    return false;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-3 cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors">
            <CardTitle className="text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-purple-600" />
                <span>Leftover Flow Diagram</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({flowData.crossWallCount} cross-wall transfers)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-muted-foreground" />
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-2">
              <svg 
                viewBox="0 0 320 180" 
                className="w-full h-auto"
                style={{ minHeight: '140px', maxHeight: '180px' }}
              >
                {/* Definitions for arrow markers */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <polygon 
                      points="0 0, 8 3, 0 6" 
                      className="fill-purple-500"
                    />
                  </marker>
                  <marker
                    id="arrowhead-highlighted"
                    markerWidth="8"
                    markerHeight="6"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <polygon 
                      points="0 0, 8 3, 0 6" 
                      className="fill-purple-700"
                    />
                  </marker>
                </defs>

                {/* Connection arrows */}
                {flowData.connections.map((conn, idx) => {
                  const highlighted = isConnectionHighlighted(conn);
                  const path = getArrowPath(conn);
                  
                  return (
                    <g key={`conn-${idx}`}>
                      <path
                        d={path}
                        fill="none"
                        stroke={highlighted ? '#7c3aed' : '#a78bfa'}
                        strokeWidth={Math.min(1 + conn.count * 0.8, 4)}
                        strokeOpacity={highlighted ? 1 : 0.7}
                        markerEnd={highlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredConnection(conn)}
                        onMouseLeave={() => setHoveredConnection(null)}
                      />
                      
                      {/* Connection count label */}
                      {conn.count > 1 && conn.fromNode && conn.toNode && (
                        <text
                          x={(conn.fromNode.x + conn.toNode.x) / 2}
                          y={(conn.fromNode.y + conn.toNode.y) / 2 - 8}
                          textAnchor="middle"
                          className="text-[9px] fill-purple-700 font-medium pointer-events-none"
                        >
                          {conn.count}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Wall nodes */}
                {flowData.nodes.map((node) => {
                  const highlighted = isNodeHighlighted(node);
                  
                  return (
                    <g key={node.id}>
                          <g 
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                          >
                            {/* Node circle */}
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={nodeRadius}
                              className={`
                                transition-all duration-200
                                ${highlighted 
                                  ? 'fill-purple-600 stroke-purple-800' 
                                  : 'fill-purple-100 dark:fill-purple-900 stroke-purple-400'
                                }
                              `}
                              strokeWidth={highlighted ? 3 : 2}
                            />
                            
                            {/* Wall name */}
                            <text
                              x={node.x}
                              y={node.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className={`text-[11px] font-bold pointer-events-none ${
                                highlighted ? 'fill-white' : 'fill-purple-700 dark:fill-purple-300'
                              }`}
                            >
                              {node.name}
                            </text>
                            
                            {/* Stats badge */}
                            {(node.sendsTo.length > 0 || node.receivesFrom.length > 0) && (
                              <g>
                                <circle
                                  cx={node.x + 20}
                                  cy={node.y - 20}
                                  r={10}
                                  className="fill-white stroke-purple-300"
                                  strokeWidth={1}
                                />
                                <text
                                  x={node.x + 20}
                                  y={node.y - 20}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  className="text-[8px] fill-purple-600 font-medium pointer-events-none"
                                >
                                  {node.sendsTo.length > 0 ? `↑${node.sendsTo.length}` : `↓${node.receivesFrom.length}`}
                                </text>
                              </g>
                            )}
                          </g>
                    </g>
                  );
                })}
              </svg>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-6 h-[2px] bg-purple-400 rounded" />
                <span>Leftover transfer</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900 border-2 border-purple-400" />
                <span>Wall with transfers</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

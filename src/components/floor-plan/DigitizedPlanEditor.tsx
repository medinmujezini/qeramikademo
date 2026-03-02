import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Move, Trash2, Plus, Eye, EyeOff, Check, 
  ZoomIn, ZoomOut, RotateCcw, Square, Circle, ArrowRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { AIFloorPlanAnalysis, AIDetectedWall, AIDetectedDoor, AIDetectedWindow, ScaleCalibration } from '@/types/floorPlanDigitizer';
import { pixelsToCm } from '@/utils/scaleCalibration';

interface DigitizedPlanEditorProps {
  imageDataUrl: string;
  analysis: AIFloorPlanAnalysis;
  scale: ScaleCalibration;
  onAnalysisUpdate: (analysis: AIFloorPlanAnalysis) => void;
  onConfirm: () => void;
}

type ToolMode = 'select' | 'move' | 'delete' | 'add-wall';

interface SelectedElement {
  type: 'wall' | 'door' | 'window';
  id: string;
}

export const DigitizedPlanEditor: React.FC<DigitizedPlanEditorProps> = ({
  imageDataUrl,
  analysis,
  scale,
  onAnalysisUpdate,
  onConfirm,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [viewScale, setViewScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [showOriginalImage, setShowOriginalImage] = useState(true);
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const [showWalls, setShowWalls] = useState(true);
  const [showDoors, setShowDoors] = useState(true);
  const [showWindows, setShowWindows] = useState(true);
  const [showRooms, setShowRooms] = useState(true);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ type: 'wall-start' | 'wall-end' | 'door' | 'window'; id: string } | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Calculate canvas size
  useEffect(() => {
    if (!containerRef.current || !imageLoaded || !imageRef.current) return;

    const updateSize = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth;
      const containerHeight = Math.min(600, window.innerHeight * 0.6);

      const scaleX = containerWidth / analysis.imageWidth;
      const scaleY = containerHeight / analysis.imageHeight;
      const fitScale = Math.min(scaleX, scaleY, 1);

      setCanvasSize({ width: containerWidth, height: containerHeight });
      setViewScale(fitScale);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imageLoaded, analysis.imageWidth, analysis.imageHeight]);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'hsl(142, 76%, 36%)'; // Green
    if (confidence >= 0.5) return 'hsl(38, 92%, 50%)'; // Yellow
    return 'hsl(0, 72%, 51%)'; // Red
  };

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageLoaded || !imageRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    if (showOriginalImage) {
      ctx.save();
      ctx.globalAlpha = imageOpacity;
      ctx.translate(pan.x, pan.y);
      ctx.scale(viewScale, viewScale);
      ctx.drawImage(imageRef.current, 0, 0);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(viewScale, viewScale);

    // Draw rooms (filled polygons)
    if (showRooms) {
      for (const room of analysis.rooms) {
        if (room.vertices.length < 3) continue;

        ctx.beginPath();
        ctx.moveTo(room.vertices[0].x, room.vertices[0].y);
        for (let i = 1; i < room.vertices.length; i++) {
          ctx.lineTo(room.vertices[i].x, room.vertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = `hsla(210, 100%, 50%, ${room.confidence * 0.1})`;
        ctx.fill();

        // Room label
        const centerX = room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length;
        const centerY = room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length;
        
        ctx.fillStyle = 'hsl(210, 100%, 30%)';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(room.label, centerX, centerY);
      }
    }

    // Draw walls
    if (showWalls) {
      for (const wall of analysis.walls) {
        const isSelected = selectedElement?.type === 'wall' && selectedElement.id === wall.id;
        
        ctx.beginPath();
        ctx.moveTo(wall.startX, wall.startY);
        ctx.lineTo(wall.endX, wall.endY);
        ctx.strokeStyle = isSelected ? 'hsl(280, 100%, 50%)' : getConfidenceColor(wall.confidence);
        ctx.lineWidth = isSelected ? wall.thickness + 4 : wall.thickness;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw endpoints for selected wall
        if (isSelected) {
          // Start point
          ctx.beginPath();
          ctx.arc(wall.startX, wall.startY, 8, 0, Math.PI * 2);
          ctx.fillStyle = 'hsl(280, 100%, 50%)';
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();

          // End point
          ctx.beginPath();
          ctx.arc(wall.endX, wall.endY, 8, 0, Math.PI * 2);
          ctx.fillStyle = 'hsl(280, 100%, 50%)';
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Draw doors
    if (showDoors) {
      for (const door of analysis.doors) {
        const isSelected = selectedElement?.type === 'door' && selectedElement.id === door.id;
        
        ctx.beginPath();
        ctx.arc(door.x, door.y, door.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'hsla(280, 100%, 50%, 0.3)' : `hsla(30, 100%, 50%, ${door.confidence * 0.5})`;
        ctx.fill();
        ctx.strokeStyle = isSelected ? 'hsl(280, 100%, 50%)' : getConfidenceColor(door.confidence);
        ctx.lineWidth = 3;
        ctx.stroke();

        // Door symbol
        ctx.fillStyle = isSelected ? 'hsl(280, 100%, 50%)' : 'hsl(30, 100%, 40%)';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('D', door.x, door.y + 4);
      }
    }

    // Draw windows
    if (showWindows) {
      for (const window of analysis.windows) {
        const isSelected = selectedElement?.type === 'window' && selectedElement.id === window.id;
        
        ctx.beginPath();
        ctx.rect(window.x - window.width / 2, window.y - window.height / 2, window.width, window.height);
        ctx.fillStyle = isSelected ? 'hsla(280, 100%, 50%, 0.3)' : `hsla(200, 100%, 50%, ${window.confidence * 0.5})`;
        ctx.fill();
        ctx.strokeStyle = isSelected ? 'hsl(280, 100%, 50%)' : getConfidenceColor(window.confidence);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Window symbol
        ctx.fillStyle = isSelected ? 'hsl(280, 100%, 50%)' : 'hsl(200, 100%, 30%)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('W', window.x, window.y + 3);
      }
    }

    ctx.restore();
  }, [
    imageLoaded, viewScale, pan, analysis, 
    showOriginalImage, imageOpacity, 
    showWalls, showDoors, showWindows, showRooms,
    selectedElement
  ]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert to image coordinates
    const imageX = (screenX - pan.x) / viewScale;
    const imageY = (screenY - pan.y) / viewScale;

    if (toolMode === 'select') {
      // Check for element selection
      let found = false;

      // Check doors first (smaller elements)
      for (const door of analysis.doors) {
        const dist = Math.sqrt(Math.pow(door.x - imageX, 2) + Math.pow(door.y - imageY, 2));
        if (dist < door.width / 2 + 10) {
          setSelectedElement({ type: 'door', id: door.id });
          found = true;
          break;
        }
      }

      // Check windows
      if (!found) {
        for (const window of analysis.windows) {
          if (
            imageX >= window.x - window.width / 2 - 10 &&
            imageX <= window.x + window.width / 2 + 10 &&
            imageY >= window.y - window.height / 2 - 10 &&
            imageY <= window.y + window.height / 2 + 10
          ) {
            setSelectedElement({ type: 'window', id: window.id });
            found = true;
            break;
          }
        }
      }

      // Check walls
      if (!found) {
        for (const wall of analysis.walls) {
          // Distance from point to line segment
          const dx = wall.endX - wall.startX;
          const dy = wall.endY - wall.startY;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) continue;

          const t = Math.max(0, Math.min(1,
            ((imageX - wall.startX) * dx + (imageY - wall.startY) * dy) / (len * len)
          ));

          const projX = wall.startX + t * dx;
          const projY = wall.startY + t * dy;
          const dist = Math.sqrt(Math.pow(imageX - projX, 2) + Math.pow(imageY - projY, 2));

          if (dist < wall.thickness + 10) {
            setSelectedElement({ type: 'wall', id: wall.id });
            found = true;
            break;
          }
        }
      }

      if (!found) {
        setSelectedElement(null);
      }
    } else if (toolMode === 'delete' && selectedElement) {
      handleDeleteSelected();
    }
  }, [toolMode, analysis, viewScale, pan]);

  // Delete selected element
  const handleDeleteSelected = useCallback(() => {
    if (!selectedElement) return;

    const newAnalysis = { ...analysis };

    if (selectedElement.type === 'wall') {
      newAnalysis.walls = analysis.walls.filter(w => w.id !== selectedElement.id);
    } else if (selectedElement.type === 'door') {
      newAnalysis.doors = analysis.doors.filter(d => d.id !== selectedElement.id);
    } else if (selectedElement.type === 'window') {
      newAnalysis.windows = analysis.windows.filter(w => w.id !== selectedElement.id);
    }

    onAnalysisUpdate(newAnalysis);
    setSelectedElement(null);
  }, [selectedElement, analysis, onAnalysisUpdate]);

  // Handle zoom
  const handleZoom = (delta: number) => {
    setViewScale(prev => Math.max(0.1, Math.min(5, prev + delta)));
  };

  // Stats
  const stats = {
    walls: analysis.walls.length,
    doors: analysis.doors.length,
    windows: analysis.windows.length,
    rooms: analysis.rooms.length,
    avgConfidence: (
      (analysis.walls.reduce((sum, w) => sum + w.confidence, 0) / analysis.walls.length) || 0
    ).toFixed(0),
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 border rounded-md p-1">
          <Button 
            size="sm" 
            variant={toolMode === 'select' ? 'default' : 'ghost'}
            onClick={() => setToolMode('select')}
          >
            <Move className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant={toolMode === 'delete' ? 'destructive' : 'ghost'}
            onClick={() => setToolMode('delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border rounded-md p-1">
          <Button size="sm" variant="ghost" onClick={() => handleZoom(0.2)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleZoom(-0.2)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline">
            {stats.walls} walls
          </Badge>
          <Badge variant="outline">
            {stats.doors} doors
          </Badge>
          <Badge variant="outline">
            {stats.windows} windows
          </Badge>
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={containerRef} 
        className="relative border rounded-md overflow-hidden bg-muted/50"
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          className="cursor-crosshair"
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          <Switch 
            id="show-image" 
            checked={showOriginalImage} 
            onCheckedChange={setShowOriginalImage}
          />
          <Label htmlFor="show-image">Show Image</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch 
            id="show-walls" 
            checked={showWalls} 
            onCheckedChange={setShowWalls}
          />
          <Label htmlFor="show-walls">Walls</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch 
            id="show-doors" 
            checked={showDoors} 
            onCheckedChange={setShowDoors}
          />
          <Label htmlFor="show-doors">Doors</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch 
            id="show-windows" 
            checked={showWindows} 
            onCheckedChange={setShowWindows}
          />
          <Label htmlFor="show-windows">Windows</Label>
        </div>
      </div>

      {/* Image opacity slider */}
      {showOriginalImage && (
        <div className="space-y-2">
          <Label>Image Opacity: {Math.round(imageOpacity * 100)}%</Label>
          <Slider
            value={[imageOpacity * 100]}
            onValueChange={([v]) => setImageOpacity(v / 100)}
            min={10}
            max={100}
            step={5}
          />
        </div>
      )}

      {/* Selected element info */}
      {selectedElement && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium capitalize">{selectedElement.type} selected</span>
                {selectedElement.type === 'wall' && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {(() => {
                      const wall = analysis.walls.find(w => w.id === selectedElement.id);
                      if (!wall) return '';
                      const length = Math.sqrt(
                        Math.pow(wall.endX - wall.startX, 2) + Math.pow(wall.endY - wall.startY, 2)
                      );
                      return `${Math.round(pixelsToCm(length, scale.pixelsPerCm))} cm`;
                    })()}
                  </span>
                )}
              </div>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={onConfirm}>
          <Check className="h-4 w-4 mr-2" />
          Confirm & Import
        </Button>
      </div>
    </div>
  );
};

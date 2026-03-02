/**
 * Professional MEP Symbol Library
 * Industry-standard symbols for plumbing, electrical, and HVAC visualization
 */

export interface SymbolStyle {
  fillColor: string;
  strokeColor: string;
  lineWidth: number;
  scale: number;
}

const defaultStyle: SymbolStyle = {
  fillColor: 'hsl(var(--background))',
  strokeColor: '#3b82f6',
  lineWidth: 2,
  scale: 1,
};

// ============================================
// VALVE SYMBOLS
// ============================================

export const drawGateValve = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  // Bowtie shape
  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Left triangle
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(0, -8);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right triangle
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(0, -8);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Stem
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(0, -14);
  ctx.stroke();

  // Handwheel
  ctx.beginPath();
  ctx.arc(0, -16, 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
};

export const drawBallValve = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Body triangles
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ball (filled circle in center)
  ctx.fillStyle = s.strokeColor;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Lever handle
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -12);
  ctx.stroke();

  ctx.restore();
};

export const drawCheckValve = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Circle body
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Arrow showing flow direction
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.moveTo(2, -4);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, 4);
  ctx.stroke();

  ctx.restore();
};

export const drawPressureReducingValve = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Diamond body
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(10, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Arrow inside
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(4, 0);
  ctx.moveTo(2, -3);
  ctx.lineTo(4, 0);
  ctx.lineTo(2, 3);
  ctx.stroke();

  ctx.restore();
};

export const drawShutoffValve = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Bowtie with X
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Handle
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, -11);
  ctx.moveTo(-4, -11);
  ctx.lineTo(4, -11);
  ctx.stroke();

  ctx.restore();
};

// ============================================
// FITTING SYMBOLS
// ============================================

export const drawElbow90 = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth + 1;
  ctx.lineCap = 'round';

  // 90-degree arc
  ctx.beginPath();
  ctx.arc(6, -6, 6, Math.PI / 2, Math.PI);
  ctx.stroke();

  // Flanges
  ctx.lineWidth = s.lineWidth;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(4, 0);
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 4);
  ctx.stroke();

  ctx.restore();
};

export const drawElbow45 = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth + 1;
  ctx.lineCap = 'round';

  // 45-degree angle
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(0, 0);
  ctx.lineTo(4, -4);
  ctx.stroke();

  ctx.restore();
};

export const drawTee = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // T-shape
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // T lines
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(8, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 8);
  ctx.stroke();

  ctx.restore();
};

export const drawCross = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cross lines
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(8, 0);
  ctx.moveTo(0, -8);
  ctx.lineTo(0, 8);
  ctx.stroke();

  ctx.restore();
};

export const drawReducer = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Trapezoid shape
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.lineTo(8, -4);
  ctx.lineTo(8, 4);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
};

export const drawUnion = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Hexagon shape
  ctx.beginPath();
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const a = (i * Math.PI * 2) / sides - Math.PI / 6;
    const px = Math.cos(a) * 7;
    const py = Math.sin(a) * 7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
};

export const drawCap = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.strokeColor;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;

  // Rounded cap
  ctx.beginPath();
  ctx.arc(0, 0, 6, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  // Connection line
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-8, 6);
  ctx.lineTo(0, 6);
  ctx.stroke();

  ctx.restore();
};

// ============================================
// FIXTURE CONNECTION SYMBOLS
// ============================================

export const drawWaterSupplyPoint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isHot: boolean = false,
  connected: boolean = false,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  // Color based on hot/cold
  const color = isHot ? '#ef4444' : '#3b82f6';
  
  ctx.fillStyle = color;
  ctx.strokeStyle = connected ? '#22c55e' : '#ef4444';
  ctx.lineWidth = s.lineWidth;

  // Circle with indicator
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // H or C label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isHot ? 'H' : 'C', 0, 0);

  ctx.restore();
};

export const drawDrainPoint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  connected: boolean = false,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = '#92400e';
  ctx.strokeStyle = connected ? '#22c55e' : '#ef4444';
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // D label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', 0, 0);

  ctx.restore();
};

export const drawVentPoint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  connected: boolean = false,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = connected ? '#22c55e' : '#f59e0b';
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // V label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('V', 0, 0);

  ctx.restore();
};

// ============================================
// ELECTRICAL SYMBOLS
// ============================================

export const drawOutlet = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  isDuplex: boolean = true,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (isDuplex) {
    // Two prongs
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.lineTo(-3, -6);
    ctx.moveTo(3, -3);
    ctx.lineTo(3, -6);
    ctx.moveTo(-3, 3);
    ctx.lineTo(-3, 6);
    ctx.moveTo(3, 3);
    ctx.lineTo(3, 6);
    ctx.stroke();
  }

  ctx.restore();
};

export const drawGFCIOutlet = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // GFCI label
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GFI', 0, 0);

  ctx.restore();
};

export const drawSwitch = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // S label
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', 0, 1);

  ctx.restore();
};

export const draw3WaySwitch = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // S3 label
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S₃', 0, 1);

  ctx.restore();
};

export const drawDimmerSwitch = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // SD label
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SD', 0, 1);

  ctx.restore();
};

export const drawCeilingLight = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = '#fef3c7';
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Outer circle
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner cross pattern (light rays)
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.moveTo(-4, -4);
  ctx.lineTo(4, 4);
  ctx.moveTo(4, -4);
  ctx.lineTo(-4, 4);
  ctx.stroke();

  ctx.restore();
};

export const drawWallLight = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = '#fef3c7';
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Half circle (mounted on wall)
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI);
  ctx.fill();
  ctx.stroke();

  // Light rays
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, 3);
  ctx.lineTo(-4, 7);
  ctx.moveTo(0, 3);
  ctx.lineTo(0, 8);
  ctx.moveTo(4, 3);
  ctx.lineTo(4, 7);
  ctx.stroke();

  ctx.restore();
};

export const drawRecessed = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = '#fef3c7';
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Square with circle inside
  ctx.strokeRect(-10, -10, 20, 20);
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
};

export const drawJunctionBox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Octagon
  ctx.beginPath();
  const r = 10;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 8;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // J label
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('J', 0, 0);

  ctx.restore();
};

export const drawElectricalPanel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = s.fillColor;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = s.lineWidth;

  // Rectangle with internal breakers
  ctx.fillRect(-12, -18, 24, 36);
  ctx.strokeRect(-12, -18, 24, 36);

  // Breaker slots
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.strokeRect(-8, -14 + i * 8, 16, 6);
  }

  ctx.restore();
};

// ============================================
// INFRASTRUCTURE SYMBOLS
// ============================================

export const drawDrainStack = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isDragging: boolean = false,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = isDragging ? '#b45309' : '#92400e';
  ctx.strokeStyle = 'hsl(var(--background))';
  ctx.lineWidth = 2;

  // Square with rounded corners
  ctx.beginPath();
  ctx.roundRect(-16, -16, 32, 32, 4);
  ctx.fill();
  ctx.stroke();

  // Pipe cross-section
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  // Down arrow
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(-4, 4);
  ctx.lineTo(4, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

export const drawWaterManifold = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isDragging: boolean = false,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = isDragging ? '#2563eb' : '#3b82f6';
  ctx.strokeStyle = 'hsl(var(--background))';
  ctx.lineWidth = 2;

  // Diamond shape
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(18, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(-18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Manifold outlets
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(-8, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const drawElectricalPanelNode = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isDragging: boolean = false,
  style: Partial<SymbolStyle> = {}
) => {
  const s = { ...defaultStyle, ...style };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s.scale, s.scale);

  ctx.fillStyle = isDragging ? '#ca8a04' : '#eab308';
  ctx.strokeStyle = 'hsl(var(--background))';
  ctx.lineWidth = 2;

  // Panel rectangle
  ctx.beginPath();
  ctx.roundRect(-14, -20, 28, 40, 4);
  ctx.fill();
  ctx.stroke();

  // Lightning bolt
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-3, 12);
  ctx.lineTo(6, 0);
  ctx.lineTo(1, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

// ============================================
// FLOW DIRECTION ARROWS
// ============================================

export const drawFlowArrow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string = '#3b82f6',
  size: number = 1
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

export const drawFlowArrowsAlongPath = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string = '#3b82f6',
  spacing: number = 60,
  reverse: boolean = false
) => {
  if (points.length < 2) return;

  let accumulatedDist = spacing / 2; // Start half-spacing in

  for (let i = 1; i < points.length; i++) {
    const p1 = reverse ? points[points.length - i] : points[i - 1];
    const p2 = reverse ? points[points.length - 1 - i] : points[i];

    const segmentDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    let segmentProgress = 0;

    while (segmentProgress + (spacing - accumulatedDist) < segmentDist) {
      segmentProgress += spacing - accumulatedDist;
      accumulatedDist = 0;

      const t = segmentProgress / segmentDist;
      const arrowX = p1.x + (p2.x - p1.x) * t;
      const arrowY = p1.y + (p2.y - p1.y) * t;

      drawFlowArrow(ctx, arrowX, arrowY, angle, color);
    }

    accumulatedDist += segmentDist - segmentProgress;
  }
};

// ============================================
// DIMENSION LINES
// ============================================

export const drawDimensionLine = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  offset: number = 15,
  color: string = 'hsl(var(--foreground))'
) => {
  ctx.save();

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Perpendicular offset
  const perpX = -Math.sin(angle) * offset;
  const perpY = Math.cos(angle) * offset;

  const startX = x1 + perpX;
  const startY = y1 + perpY;
  const endX = x2 + perpX;
  const endY = y2 + perpY;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  // Extension lines
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(startX, startY);
  ctx.moveTo(x2, y2);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Dimension line
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Arrows
  const arrowSize = 6;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX + Math.cos(angle + Math.PI * 0.8) * arrowSize, startY + Math.sin(angle + Math.PI * 0.8) * arrowSize);
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX + Math.cos(angle - Math.PI * 0.8) * arrowSize, startY + Math.sin(angle - Math.PI * 0.8) * arrowSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX + Math.cos(angle + Math.PI + Math.PI * 0.2) * arrowSize, endY + Math.sin(angle + Math.PI + Math.PI * 0.2) * arrowSize);
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX + Math.cos(angle + Math.PI - Math.PI * 0.2) * arrowSize, endY + Math.sin(angle + Math.PI - Math.PI * 0.2) * arrowSize);
  ctx.stroke();

  // Label
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(angle > Math.PI / 2 || angle < -Math.PI / 2 ? angle + Math.PI : angle);

  ctx.fillStyle = 'hsl(var(--background))';
  ctx.font = 'bold 10px sans-serif';
  const textWidth = ctx.measureText(label).width;
  ctx.fillRect(-textWidth / 2 - 4, -8, textWidth + 8, 16);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);

  ctx.restore();
  ctx.restore();
};

// ============================================
// PIPE SIZE LABELS
// ============================================

export const drawPipeSizeLabel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  diameter: number,
  color: string = '#3b82f6'
) => {
  ctx.save();

  const label = `Ø${diameter}`;
  ctx.font = 'bold 9px sans-serif';
  const textWidth = ctx.measureText(label).width;

  // Background pill
  ctx.fillStyle = 'hsl(var(--background))';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - 5, y - 7, textWidth + 10, 14, 4);
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);

  ctx.restore();
};

// ============================================
// SLOPE INDICATORS
// ============================================

export const drawSlopeIndicator = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  slopePercent: number,
  angle: number,
  color: string = '#92400e'
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const label = `↘${slopePercent.toFixed(1)}%`;
  ctx.font = 'bold 9px sans-serif';
  const textWidth = ctx.measureText(label).width;

  // Background pill
  ctx.fillStyle = '#fffbeb';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-textWidth / 2 - 4, -8, textWidth + 8, 16, 4);
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);

  ctx.restore();
};

// ============================================
// LINE STYLE UTILITIES
// ============================================

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'center' | 'hidden';

export const applyLineStyle = (ctx: CanvasRenderingContext2D, style: LineStyle) => {
  switch (style) {
    case 'solid':
      ctx.setLineDash([]);
      break;
    case 'dashed':
      ctx.setLineDash([10, 5]);
      break;
    case 'dotted':
      ctx.setLineDash([2, 4]);
      break;
    case 'center':
      ctx.setLineDash([15, 5, 5, 5]); // Long-short-long pattern
      break;
    case 'hidden':
      ctx.setLineDash([5, 5]); // Hidden/concealed lines
      break;
  }
};

// ============================================
// COLOR CONSTANTS
// ============================================

export const MEP_COLORS = {
  // Water supply
  coldWater: '#3b82f6',
  hotWater: '#ef4444',
  recirculatedWater: '#ec4899',
  
  // Drainage
  sanitaryDrain: '#92400e',
  stormDrain: '#059669',
  vent: '#22c55e',
  
  // Gas
  naturalGas: '#f59e0b',
  lpg: '#f97316',
  
  // Electrical
  power: '#eab308',
  lighting: '#fbbf24',
  lowVoltage: '#a855f7',
  data: '#06b6d4',
  
  // HVAC
  supplyAir: '#60a5fa',
  returnAir: '#fb923c',
  exhaustAir: '#a3a3a3',
  refrigerant: '#2dd4bf',
} as const;

export const getSystemColor = (system: string): string => {
  const colorMap: Record<string, string> = {
    'water-supply': MEP_COLORS.coldWater,
    'hot-water': MEP_COLORS.hotWater,
    'drainage': MEP_COLORS.sanitaryDrain,
    'vent': MEP_COLORS.vent,
    'electrical': MEP_COLORS.power,
    'lighting': MEP_COLORS.lighting,
  };
  return colorMap[system] || '#6b7280';
};

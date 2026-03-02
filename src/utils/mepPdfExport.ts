import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { FloorPlan, PlumbingRoute, ElectricalRoute, Fixture, InfrastructureNode, Wall, Point } from '@/types/floorPlan';
import { MEP_COLORS } from './mepSymbols';

// Extend jsPDF type
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

interface MEPExportConfig {
  projectName: string;
  floorPlan: FloorPlan;
  includeSchedule?: boolean;
  includeRiserDiagram?: boolean;
  includeBOM?: boolean;
  scale?: number; // pixels per meter
}

interface ExportStats {
  totalPipeLength: number;
  totalWireLength: number;
  fixtureCount: number;
  plumbingRouteCount: number;
  electricalRouteCount: number;
  waterSupplyRoutes: number;
  drainageRoutes: number;
}

// Calculate stats from floor plan
function calculateStats(floorPlan: FloorPlan): ExportStats {
  const plumbingRoutes = floorPlan.plumbingRoutes;
  const electricalRoutes = floorPlan.electricalRoutes;
  const fixtures = floorPlan.fixtures.filter(f => 
    f.category === 'bathroom' || f.category === 'kitchen'
  );

  return {
    totalPipeLength: plumbingRoutes.reduce((sum, r) => sum + r.length, 0) / 100,
    totalWireLength: electricalRoutes.reduce((sum, r) => sum + r.length, 0) / 100,
    fixtureCount: fixtures.length,
    plumbingRouteCount: plumbingRoutes.length,
    electricalRouteCount: electricalRoutes.length,
    waterSupplyRoutes: plumbingRoutes.filter(r => r.type === 'water-supply').length,
    drainageRoutes: plumbingRoutes.filter(r => r.type === 'drainage').length
  };
}

// Draw floor plan with MEP routes
function drawPlanView(
  doc: jsPDF,
  floorPlan: FloorPlan,
  startX: number,
  startY: number,
  maxWidth: number,
  maxHeight: number
): { endY: number } {
  const { walls, points, plumbingRoutes, electricalRoutes, fixtures, infrastructureNodes } = floorPlan;
  
  // Calculate scale to fit
  const planWidth = floorPlan.roomWidth;
  const planHeight = floorPlan.roomHeight;
  const scaleX = maxWidth / planWidth;
  const scaleY = maxHeight / planHeight;
  const scale = Math.min(scaleX, scaleY) * 0.9;
  
  const offsetX = startX + (maxWidth - planWidth * scale) / 2;
  const offsetY = startY + (maxHeight - planHeight * scale) / 2;

  // Transform function
  const tx = (x: number) => offsetX + x * scale;
  const ty = (y: number) => offsetY + y * scale;

  // Draw walls
  doc.setLineWidth(0.5);
  doc.setDrawColor(100, 100, 100);
  walls.forEach(wall => {
    const start = points.find(p => p.id === wall.startPointId);
    const end = points.find(p => p.id === wall.endPointId);
    if (start && end) {
      doc.line(tx(start.x), ty(start.y), tx(end.x), ty(end.y));
    }
  });

  // Draw fixtures (simplified rectangles)
  doc.setFillColor(220, 220, 220);
  fixtures.forEach(fixture => {
    const x = fixture.cx - fixture.width / 2;
    const y = fixture.cy - fixture.depth / 2;
    doc.rect(tx(x), ty(y), fixture.width * scale, fixture.depth * scale, 'F');
    
    // Label
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text(
      fixture.type.charAt(0).toUpperCase(),
      tx(fixture.cx),
      ty(fixture.cy) + 2,
      { align: 'center' }
    );
  });

  // Draw infrastructure nodes
  infrastructureNodes.forEach(node => {
    if (node.type === 'water-manifold') {
      doc.setFillColor(0, 120, 255);
      doc.circle(tx(node.x), ty(node.y), 3, 'F');
    } else if (node.type === 'drain-stack') {
      doc.setFillColor(139, 90, 43);
      doc.circle(tx(node.x), ty(node.y), 3, 'F');
    } else if (node.type === 'electrical-panel') {
      doc.setFillColor(255, 165, 0);
      doc.rect(tx(node.x) - 3, ty(node.y) - 3, 6, 6, 'F');
    }
  });

  // Draw plumbing routes
  plumbingRoutes.forEach(route => {
    if (route.type === 'water-supply') {
      doc.setDrawColor(0, 120, 255); // Blue for water
      doc.setLineWidth(0.3);
    } else {
      doc.setDrawColor(139, 90, 43); // Brown for drainage
      doc.setLineWidth(0.4);
    }
    
    for (let i = 0; i < route.points.length - 1; i++) {
      const p1 = route.points[i];
      const p2 = route.points[i + 1];
      doc.line(tx(p1.x), ty(p1.y), tx(p2.x), ty(p2.y));
    }
  });

  // Draw electrical routes
  doc.setDrawColor(255, 165, 0); // Orange for electrical
  doc.setLineWidth(0.2);
  electricalRoutes.forEach(route => {
    for (let i = 0; i < route.points.length - 1; i++) {
      const p1 = route.points[i];
      const p2 = route.points[i + 1];
      doc.line(tx(p1.x), ty(p1.y), tx(p2.x), ty(p2.y));
    }
  });

  // Draw legend
  const legendX = startX + maxWidth - 45;
  const legendY = startY + 5;
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text('Legend:', legendX, legendY);
  
  doc.setFillColor(0, 120, 255);
  doc.rect(legendX, legendY + 3, 8, 2, 'F');
  doc.text('Water Supply', legendX + 10, legendY + 5);
  
  doc.setFillColor(139, 90, 43);
  doc.rect(legendX, legendY + 8, 8, 2, 'F');
  doc.text('Drainage', legendX + 10, legendY + 10);
  
  doc.setFillColor(255, 165, 0);
  doc.rect(legendX, legendY + 13, 8, 2, 'F');
  doc.text('Electrical', legendX + 10, legendY + 15);

  return { endY: startY + maxHeight };
}

// Draw riser diagram (simplified)
function drawRiserDiagram(
  doc: jsPDF,
  floorPlan: FloorPlan,
  startX: number,
  startY: number,
  width: number
): { endY: number } {
  const { plumbingRoutes, fixtures, infrastructureNodes } = floorPlan;
  const drainStack = infrastructureNodes.find(n => n.type === 'drain-stack');
  const waterManifold = infrastructureNodes.find(n => n.type === 'water-manifold');
  
  const mepFixtures = fixtures.filter(f => f.category === 'bathroom' || f.category === 'kitchen');
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Plumbing Riser Diagram', startX + width / 2, startY, { align: 'center' });
  
  const diagramStartY = startY + 10;
  const fixtureSpacing = 25;
  const stackX = startX + width / 2;
  
  // Draw main stack
  doc.setLineWidth(1);
  doc.setDrawColor(139, 90, 43);
  const stackHeight = mepFixtures.length * fixtureSpacing + 30;
  doc.line(stackX, diagramStartY, stackX, diagramStartY + stackHeight);
  
  // Draw fixtures and connections
  mepFixtures.forEach((fixture, index) => {
    const y = diagramStartY + 15 + index * fixtureSpacing;
    const fixtureX = index % 2 === 0 ? stackX - 40 : stackX + 40;
    
    // Fixture box
    doc.setFillColor(240, 240, 240);
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.rect(fixtureX - 15, y - 8, 30, 16, 'FD');
    
    // Fixture label
    doc.setFontSize(6);
    doc.text(fixture.type.toUpperCase(), fixtureX, y + 2, { align: 'center' });
    
    // Connection line
    doc.setLineWidth(0.5);
    doc.setDrawColor(139, 90, 43);
    doc.line(fixtureX + (index % 2 === 0 ? 15 : -15), y, stackX, y);
  });
  
  // Stack label
  doc.setFontSize(7);
  doc.text('DRAIN STACK', stackX, diagramStartY + stackHeight + 8, { align: 'center' });
  
  return { endY: diagramStartY + stackHeight + 15 };
}

// Generate fixture schedule table
function drawFixtureSchedule(
  doc: jsPDFWithAutoTable,
  floorPlan: FloorPlan,
  startY: number
): { endY: number } {
  const { fixtures, plumbingRoutes, electricalRoutes } = floorPlan;
  const mepFixtures = fixtures.filter(f => f.category === 'bathroom' || f.category === 'kitchen');
  
  const tableData = mepFixtures.map((fixture, index) => {
    const waterRoutes = plumbingRoutes.filter(r => r.fixtureId === fixture.id && r.type === 'water-supply');
    const drainRoutes = plumbingRoutes.filter(r => r.fixtureId === fixture.id && r.type === 'drainage');
    const elecRoutes = electricalRoutes.filter(r => r.fixtureId === fixture.id);
    
    const totalWattage = fixture.electricalConnections.reduce((sum, c) => sum + c.wattage, 0);
    
    return [
      `F${index + 1}`,
      fixture.type.charAt(0).toUpperCase() + fixture.type.slice(1),
      waterRoutes.length > 0 ? `${waterRoutes[0].pipeSize}mm` : '-',
      drainRoutes.length > 0 ? `${drainRoutes[0].pipeSize}mm` : '-',
      totalWattage > 0 ? `${totalWattage}W` : '-',
      fixture.plumbingConnections.length.toString(),
      fixture.electricalConnections.length.toString()
    ];
  });
  
  doc.setFontSize(10);
  doc.text('Fixture Schedule', 14, startY);
  
  // Use autoTable
  (doc as any).autoTable({
    startY: startY + 5,
    head: [['Tag', 'Type', 'Water', 'Drain', 'Electrical', 'Plumb. Conn.', 'Elec. Conn.']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [80, 80, 80], fontSize: 7, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 30 },
      2: { cellWidth: 18 },
      3: { cellWidth: 18 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22 }
    }
  });
  
  return { endY: doc.lastAutoTable?.finalY ?? startY + 50 };
}

// Generate Bill of Materials table
function drawBOM(
  doc: jsPDFWithAutoTable,
  floorPlan: FloorPlan,
  startY: number
): { endY: number } {
  const { plumbingRoutes, electricalRoutes } = floorPlan;
  
  // Calculate materials
  const pipeLengths = new Map<string, number>();
  plumbingRoutes.forEach(route => {
    const key = `${route.type === 'water-supply' ? 'Water' : 'Drain'} Pipe ${route.pipeSize}mm`;
    pipeLengths.set(key, (pipeLengths.get(key) ?? 0) + route.length / 100);
  });
  
  const wireLengths = new Map<string, number>();
  electricalRoutes.forEach(route => {
    const key = `Electrical Wire ${route.wireGauge}AWG`;
    wireLengths.set(key, (wireLengths.get(key) ?? 0) + route.length / 100);
  });
  
  const tableData: string[][] = [];
  
  pipeLengths.forEach((length, material) => {
    tableData.push([material, length.toFixed(2) + 'm', 'Linear', 'Plumbing']);
  });
  
  wireLengths.forEach((length, material) => {
    tableData.push([material, length.toFixed(2) + 'm', 'Linear', 'Electrical']);
  });
  
  // Add fittings estimate
  const fittingCount = plumbingRoutes.reduce((sum, r) => sum + r.points.length - 1, 0);
  tableData.push(['Pipe Fittings (approx)', fittingCount.toString(), 'Each', 'Plumbing']);
  
  doc.setFontSize(10);
  doc.text('Bill of Materials', 14, startY);
  
  (doc as any).autoTable({
    startY: startY + 5,
    head: [['Material', 'Quantity', 'Unit', 'Category']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [80, 80, 80], fontSize: 7, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 }
    }
  });
  
  return { endY: doc.lastAutoTable?.finalY ?? startY + 50 };
}

// Main export function
export function generateMEPDrawingsPDF(config: MEPExportConfig): void {
  const { projectName, floorPlan, includeSchedule = true, includeRiserDiagram = true, includeBOM = true } = config;
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  
  const stats = calculateStats(floorPlan);
  
  // ===== PAGE 1: Title Block & Plan View =====
  
  // Title block
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('MEP DRAWINGS', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(projectName, pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 28, { align: 'center' });
  
  // Summary stats
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, 32, pageWidth - margin * 2, 18, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const statsY = 40;
  doc.text(`Fixtures: ${stats.fixtureCount}`, margin + 5, statsY);
  doc.text(`Water Routes: ${stats.waterSupplyRoutes}`, margin + 40, statsY);
  doc.text(`Drain Routes: ${stats.drainageRoutes}`, margin + 80, statsY);
  doc.text(`Elec. Routes: ${stats.electricalRouteCount}`, margin + 120, statsY);
  doc.text(`Pipe: ${stats.totalPipeLength.toFixed(1)}m`, margin + 5, statsY + 7);
  doc.text(`Wire: ${stats.totalWireLength.toFixed(1)}m`, margin + 40, statsY + 7);
  
  // Plan view
  doc.setFontSize(10);
  doc.text('MEP Plan View', margin, 58);
  
  const planResult = drawPlanView(doc, floorPlan, margin, 62, pageWidth - margin * 2, 120);
  
  // ===== PAGE 2: Riser Diagram (if enabled) =====
  if (includeRiserDiagram) {
    doc.addPage();
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    drawRiserDiagram(doc, floorPlan, margin, 20, pageWidth - margin * 2);
  }
  
  // ===== PAGE 3: Schedules & BOM =====
  if (includeSchedule || includeBOM) {
    doc.addPage();
    
    let currentY = 20;
    
    if (includeSchedule) {
      const scheduleResult = drawFixtureSchedule(doc, floorPlan, currentY);
      currentY = scheduleResult.endY + 15;
    }
    
    if (includeBOM) {
      // Check if we need a new page
      if (currentY > pageHeight - 80) {
        doc.addPage();
        currentY = 20;
      }
      drawBOM(doc, floorPlan, currentY);
    }
  }
  
  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text('Generated by MEP Design Tool', margin, pageHeight - 8);
    doc.text(`Scale: NTS`, pageWidth - margin - 20, pageHeight - 8);
  }
  
  // Save
  const fileName = `${projectName.replace(/\s+/g, '_')}_MEP_Drawings_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export default generateMEPDrawingsPDF;

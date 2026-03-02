// PDF Export Utility for Tile Cut Lists
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CutOptimizationResult, WallCalculationResult } from './tileCalculator';
import { Wall, Point, Tile } from '@/types/floorPlan';

interface ExportConfig {
  projectName: string;
  optimization: CutOptimizationResult;
  wallResults: WallCalculationResult[];
  walls: Wall[];
  points: Point[];
  tiles: Tile[];
}

// Extend jsPDF to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: { finalY: number };
  }
}

function getWallName(wallId: string, walls: Wall[], index?: number): string {
  const idx = walls.findIndex(w => w.id === wallId);
  return `Wall ${String.fromCharCode(65 + (index ?? idx))}`;
}

function getWallDimensions(wall: Wall, points: Point[]): { length: number; height: number } {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return { length: 0, height: wall.height };
  const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  return { length: Math.round(length), height: wall.height };
}

export function generateCutListPDF(config: ExportConfig): void {
  const { projectName, optimization, wallResults, walls, points, tiles } = config;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPos = 20;

  // Helper to check page break
  const checkPageBreak = (needed: number) => {
    if (yPos + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // ===== HEADER =====
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('TILE CUT LIST', margin, yPos);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(projectName, margin, yPos + 7);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, yPos);
  
  yPos += 20;

  // ===== SUMMARY BOX =====
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 32, 3, 3, 'FD');
  
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', margin + 6, yPos + 8);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Standard vs Optimized
  const standardText = `Standard: ${optimization.standardTilesNeeded} tiles`;
  const optimizedText = `Optimized: ${optimization.optimizedTilesNeeded} tiles`;
  const savingsText = `Save ${optimization.tilesSaved} tiles ($${optimization.costSaved.toFixed(0)})`;
  
  doc.text(standardText, margin + 6, yPos + 18);
  doc.text(optimizedText, margin + 70, yPos + 18);
  
  doc.setTextColor(34, 139, 34);
  doc.setFont('helvetica', 'bold');
  doc.text(savingsText, margin + 140, yPos + 18);
  
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Reused pieces: ${optimization.reusedPieces.length} | Same-wall: ${optimization.reusedPieces.filter(r => !r.isCrossWall).length} | Cross-wall: ${optimization.reusedPieces.filter(r => r.isCrossWall).length}`, margin + 6, yPos + 27);
  
  yPos += 40;

  // ===== CUT LIST BY WALL =====
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CUT LIST BY WALL', margin, yPos);
  yPos += 8;

  wallResults.forEach((wallResult, wallIdx) => {
    const wall = walls.find(w => w.id === wallResult.wallId);
    if (!wall) return;
    
    const dims = getWallDimensions(wall, points);
    const wallName = getWallName(wallResult.wallId, walls, wallIdx);
    
    checkPageBreak(60);
    
    // Wall header
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`${wallName} (${dims.length}cm × ${dims.height}cm)`, margin + 4, yPos + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const tileSummary = `${wallResult.fullTiles} full + ${wallResult.cutTiles.reduce((sum, c) => sum + c.count, 0)} cut tiles`;
    doc.text(tileSummary, pageWidth - margin - 50, yPos + 7);
    
    yPos += 14;
    
    // Cut tiles table for this wall
    if (wallResult.cutTiles.length > 0) {
      const cutData = wallResult.cutTiles.map((cut, idx) => {
        // Check if this cut has a reuse source
        const reuseInfo = optimization.reusedPieces.find(
          r => r.usedForCut.wallId === wallResult.wallId && 
               Math.abs(r.usedForCut.width - cut.cutWidth) < 1 &&
               Math.abs(r.usedForCut.height - cut.cutHeight) < 1
        );
        
        const reuseSuggestion = reuseInfo 
          ? `← From ${reuseInfo.leftoverPiece.sourceDescription || 'leftover'}`
          : '';
        
        const cutType = cut.cutType || 'straight';
        const cutTypeLabel = cutType === 'angled' ? 'Angled' : cutType === 'triangular' ? 'Triangle' : 'Straight';
        
        return [
          `${wallName.slice(-1)}${idx + 1}`,
          `${cut.cutWidth.toFixed(1)} × ${cut.cutHeight.toFixed(1)} cm`,
          cutTypeLabel,
          String(cut.count),
          reuseSuggestion
        ];
      });
      
      autoTable(doc, {
        startY: yPos,
        head: [['Ref', 'Dimensions', 'Type', 'Qty', 'Reuse Note']],
        body: cutData,
        theme: 'striped',
        headStyles: { 
          fillColor: [71, 85, 105], 
          fontSize: 8,
          cellPadding: 2
        },
        bodyStyles: { 
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 45 },
          2: { cellWidth: 25 },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 'auto', textColor: [34, 139, 34], fontStyle: 'italic' }
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc.lastAutoTable?.finalY || yPos) + 10;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text('No cut tiles needed for this wall', margin + 4, yPos + 4);
      yPos += 12;
    }
  });

  // ===== LEFTOVER REUSE INSTRUCTIONS =====
  checkPageBreak(60);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('LEFTOVER REUSE INSTRUCTIONS', margin, yPos);
  yPos += 8;
  
  if (optimization.reusedPieces.length > 0) {
    // Cross-wall reuses (most important to highlight)
    const crossWallReuses = optimization.reusedPieces.filter(r => r.isCrossWall);
    const sameWallReuses = optimization.reusedPieces.filter(r => !r.isCrossWall);
    
    if (crossWallReuses.length > 0) {
      checkPageBreak(40);
      
      doc.setFillColor(243, 232, 255);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 8, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(126, 34, 206);
      doc.text(`Cross-Wall Reuses (${crossWallReuses.length} pieces to save and move)`, margin + 4, yPos + 5.5);
      yPos += 12;
      
      const crossData = crossWallReuses.map(r => [
        r.leftoverPiece.sourceDescription || 'Unknown',
        `${r.leftoverPiece.width.toFixed(1)} × ${r.leftoverPiece.height.toFixed(1)} cm`,
        '→',
        r.usedForCut.wallDescription || `Wall ${r.usedForCut.wallId?.slice(-4)}`,
        `${r.usedForCut.width.toFixed(1)} × ${r.usedForCut.height.toFixed(1)} cm`
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Source Wall', 'Leftover Size', '', 'Destination', 'Cut Size']],
        body: crossData,
        theme: 'striped',
        headStyles: { 
          fillColor: [126, 34, 206], 
          fontSize: 8,
          cellPadding: 2
        },
        bodyStyles: { 
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          2: { cellWidth: 10, halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc.lastAutoTable?.finalY || yPos) + 10;
    }
    
    if (sameWallReuses.length > 0) {
      checkPageBreak(40);
      
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 8, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text(`Same-Wall Reuses (${sameWallReuses.length} pieces to reuse internally)`, margin + 4, yPos + 5.5);
      yPos += 12;
      
      const sameData = sameWallReuses.slice(0, 15).map(r => [
        r.leftoverPiece.sourceDescription || 'Unknown',
        `${r.leftoverPiece.width.toFixed(1)} × ${r.leftoverPiece.height.toFixed(1)} cm`,
        '→',
        `${r.usedForCut.width.toFixed(1)} × ${r.usedForCut.height.toFixed(1)} cm`
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Wall', 'Leftover Size', '', 'Used For']],
        body: sameData,
        theme: 'striped',
        headStyles: { 
          fillColor: [22, 101, 52], 
          fontSize: 8,
          cellPadding: 2
        },
        bodyStyles: { 
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          2: { cellWidth: 10, halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc.lastAutoTable?.finalY || yPos) + 10;
      
      if (sameWallReuses.length > 15) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`... and ${sameWallReuses.length - 15} more same-wall reuses`, margin, yPos);
        yPos += 8;
      }
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('No optimization opportunities found - cuts are too different in size.', margin, yPos + 4);
    yPos += 12;
  }

  // ===== PATTERNED TILE WARNING =====
  if (optimization.tilesSaved > 0) {
    checkPageBreak(40);
    
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 28, 3, 3, 'FD');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text('PATTERNED TILES WARNING', margin + 6, yPos + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15);
    doc.text('If your tiles have directional patterns, textures, or designs:', margin + 6, yPos + 15);
    doc.text('• Pattern orientation may not match when reusing leftovers', margin + 10, yPos + 21);
    doc.text('• This optimization works best for solid colors or random patterns', margin + 10, yPos + 26);
  }

  // ===== SAVE FILE =====
  const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_cut_list_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

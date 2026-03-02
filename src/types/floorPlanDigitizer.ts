// Types for AI-powered floor plan digitization

export interface ScaleCalibration {
  point1: { x: number; y: number };
  point2: { x: number; y: number };
  realWorldDistance: number; // in cm
  unit: 'cm' | 'mm' | 'in' | 'ft' | 'm';
  pixelsPerCm: number;
}

export interface AIDetectedWall {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number; // in pixels
  confidence: number; // 0-1
  isExterior: boolean;
}

export interface AIDetectedDoor {
  id: string;
  x: number;
  y: number;
  width: number; // in pixels
  wallId?: string;
  type: 'hinged-left' | 'hinged-right' | 'sliding' | 'double' | 'pocket';
  confidence: number;
}

export interface AIDetectedWindow {
  id: string;
  x: number;
  y: number;
  width: number; // in pixels
  height: number;
  wallId?: string;
  confidence: number;
}

export interface AIDetectedRoom {
  id: string;
  vertices: { x: number; y: number }[];
  label: string;
  confidence: number;
}

export interface AIDetectedIgnoreRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'furniture' | 'text' | 'dimension' | 'annotation';
}

export interface AIFloorPlanAnalysis {
  walls: AIDetectedWall[];
  doors: AIDetectedDoor[];
  windows: AIDetectedWindow[];
  rooms: AIDetectedRoom[];
  ignoreRegions: AIDetectedIgnoreRegion[];
  imageWidth: number;
  imageHeight: number;
  analysisConfidence: number;
}

export interface DigitizationProject {
  id: string;
  originalImageUrl: string;
  originalImageDataUrl?: string;
  scaleCalibration?: ScaleCalibration;
  aiAnalysis?: AIFloorPlanAnalysis;
  editedAnalysis?: AIFloorPlanAnalysis;
  status: 'uploading' | 'calibrating' | 'analyzing' | 'editing' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export type DigitizationStep = 'upload' | 'scale' | 'analyze' | 'edit' | 'import';

export interface DigitizationState {
  currentStep: DigitizationStep;
  project: DigitizationProject | null;
  isProcessing: boolean;
  error: string | null;
}

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Upload, RotateCw, Ruler, Settings, Cpu, CheckCircle, Loader2,
  ZoomIn, ZoomOut, Move, ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BlueprintUploadStep } from './steps/BlueprintUploadStep';
import { BlueprintNormalizeStep } from './steps/BlueprintNormalizeStep';
import { BlueprintScaleStep } from './steps/BlueprintScaleStep';
import { BlueprintSettingsStep } from './steps/BlueprintSettingsStep';
import { BlueprintProcessingStep } from './steps/BlueprintProcessingStep';
import { BlueprintReviewStep } from './steps/BlueprintReviewStep';

export interface BlueprintWizardState {
  // Image data
  originalImage: string | null;
  normalizedImage: string | null;
  imageWidth: number;
  imageHeight: number;
  
  // Normalization
  rotation: number;
  cropBounds: { x: number; y: number; width: number; height: number } | null;
  
  // Scale calibration
  scalePoints: { start: { x: number; y: number } | null; end: { x: number; y: number } | null };
  knownDistance: number; // in cm
  pixelsPerCm: number;
  
  // Settings
  defaultWallThickness: number;
  detectDoors: boolean;
  detectWindows: boolean;
  
  // Processing results
  analysis: FloorPlanAnalysis | null;
  processingStatus: 'idle' | 'processing' | 'complete' | 'error';
  processingProgress: number;
  processingError: string | null;
  processingStage: string;
}

export interface FloorPlanAnalysis {
  walls: AnalyzedWall[];
  doors: AnalyzedDoor[];
  windows: AnalyzedWindow[];
  rooms: AnalyzedRoom[];
  imageWidth: number;
  imageHeight: number;
  analysisConfidence: number;
}

export interface AnalyzedWall {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  confidence: number;
  isExterior: boolean;
}

interface AnalyzedDoor {
  id: string;
  x: number;
  y: number;
  width: number;
  type: string;
  confidence: number;
}

interface AnalyzedWindow {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface AnalyzedRoom {
  id: string;
  vertices: { x: number; y: number }[];
  label: string;
  confidence: number;
}

interface BlueprintImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (analysis: FloorPlanAnalysis, pixelsPerCm: number, settings: { wallThickness: number }) => void;
}

const STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'normalize', label: 'Adjust', icon: RotateCw },
  { id: 'scale', label: 'Scale', icon: Ruler },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'process', label: 'Process', icon: Cpu },
  { id: 'review', label: 'Review', icon: CheckCircle },
];

const PROCESSING_STAGES = [
  { threshold: 0, message: 'Preparing image for analysis...' },
  { threshold: 15, message: 'Sending to AI for processing...' },
  { threshold: 40, message: 'Detecting walls, doors, and windows...' },
  { threshold: 75, message: 'Finalizing geometry...' },
  { threshold: 95, message: 'Analysis complete!' },
];

const initialState: BlueprintWizardState = {
  originalImage: null,
  normalizedImage: null,
  imageWidth: 0,
  imageHeight: 0,
  rotation: 0,
  cropBounds: null,
  scalePoints: { start: null, end: null },
  knownDistance: 100,
  pixelsPerCm: 1,
  defaultWallThickness: 15,
  detectDoors: true,
  detectWindows: true,
  analysis: null,
  processingStatus: 'idle',
  processingProgress: 0,
  processingError: null,
  processingStage: PROCESSING_STAGES[0].message,
};

export const BlueprintImportWizard: React.FC<BlueprintImportWizardProps> = ({
  open,
  onOpenChange,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<BlueprintWizardState>(initialState);
  
  // Refs for timeout and progress management
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const updateState = useCallback((updates: Partial<BlueprintWizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleImageUpload = useCallback((imageDataUrl: string, width: number, height: number) => {
    updateState({
      originalImage: imageDataUrl,
      normalizedImage: imageDataUrl,
      imageWidth: width,
      imageHeight: height,
    });
    setCurrentStep(1);
  }, [updateState]);

  const handleNormalize = useCallback((normalizedImage: string, rotation: number) => {
    updateState({
      normalizedImage,
      rotation,
    });
    setCurrentStep(2);
  }, [updateState]);

  const handleScaleCalibration = useCallback((pixelsPerCm: number, knownDistance: number) => {
    updateState({
      pixelsPerCm,
      knownDistance,
    });
    setCurrentStep(3);
  }, [updateState]);

  const handleSettingsComplete = useCallback((settings: { wallThickness: number; detectDoors: boolean; detectWindows: boolean }) => {
    updateState({
      defaultWallThickness: settings.wallThickness,
      detectDoors: settings.detectDoors,
      detectWindows: settings.detectWindows,
    });
    setCurrentStep(4);
  }, [updateState]);

  // Start processing after settings step is complete
  useEffect(() => {
    if (currentStep === 4 && state.processingStatus === 'idle') {
      processImage();
    }
  }, [currentStep]);

  const getStageMessage = (progress: number): string => {
    for (let i = PROCESSING_STAGES.length - 1; i >= 0; i--) {
      if (progress >= PROCESSING_STAGES[i].threshold) {
        return PROCESSING_STAGES[i].message;
      }
    }
    return PROCESSING_STAGES[0].message;
  };

  const processImage = useCallback(async () => {
    if (!state.normalizedImage) return;

    // Abort any previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    // Clear any existing intervals/timeouts
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    updateState({
      processingStatus: 'processing',
      processingProgress: 5,
      processingError: null,
      processingStage: PROCESSING_STAGES[0].message,
    });

    // Progressive progress simulation
    let currentProgress = 5;
    progressIntervalRef.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + 2, 85);
      updateState({ 
        processingProgress: currentProgress,
        processingStage: getStageMessage(currentProgress),
      });
    }, 800);

    // 90-second timeout (increased for complex floor plans)
    const abortController = abortControllerRef.current;
    timeoutRef.current = setTimeout(() => {
      abortController.abort();
    }, 90000);

    try {
      // Resize & compress image client-side to stay within edge function limits
      const compressedImage = await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const MAX_EDGE = 1200;
          let w = img.width;
          let h = img.height;
          if (Math.max(w, h) > MAX_EDGE) {
            const scale = MAX_EDGE / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = state.normalizedImage!;
      });

      const { data, error } = await supabase.functions.invoke('analyze-floorplan', {
        body: { imageDataUrl: compressedImage },
      });

      // Clear intervals
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('TIMEOUT');
      }

      if (error) {
        // Check for specific error types
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (error.message?.includes('402') || error.message?.includes('payment')) {
          throw new Error('AI credits exhausted. Please add credits to continue.');
        }
        throw new Error(error.message || 'Failed to analyze floor plan');
      }

      if (!data.success || !data.analysis) {
        throw new Error(data.error || 'No analysis results returned');
      }

      // Convert pixel coordinates to cm using scale
      const analysis = convertAnalysisToCm(data.analysis, state.pixelsPerCm);
      
      updateState({
        analysis,
        processingStatus: 'complete',
        processingProgress: 100,
        processingStage: 'Analysis complete!',
      });

      // Move to review step after a brief delay
      setTimeout(() => setCurrentStep(5), 500);

    } catch (error) {
      // Clear intervals
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      console.error('Processing error:', error);
      
      let errorMessage = 'Unknown error during processing';
      if (error instanceof Error) {
        if (error.message === 'TIMEOUT' || error.name === 'AbortError') {
          errorMessage = 'Analysis timed out — the image was compressed automatically. Please click Retry.';
        } else {
          errorMessage = error.message;
        }
      }
      
      updateState({
        processingStatus: 'error',
        processingError: errorMessage,
        processingProgress: 0,
        processingStage: 'Failed',
      });

      toast.error('Processing failed', { description: errorMessage });
    }
  }, [state.normalizedImage, state.pixelsPerCm, updateState]);

  const convertAnalysisToCm = (analysis: any, pixelsPerCm: number): FloorPlanAnalysis => {
    const convert = (px: number) => px / pixelsPerCm;
    
    return {
      walls: (analysis.walls || []).map((w: any) => ({
        ...w,
        startX: convert(w.startX),
        startY: convert(w.startY),
        endX: convert(w.endX),
        endY: convert(w.endY),
        thickness: Math.max(10, convert(w.thickness || 15)),
      })),
      doors: (analysis.doors || []).map((d: any) => ({
        ...d,
        x: convert(d.x),
        y: convert(d.y),
        width: convert(d.width || 90),
      })),
      windows: (analysis.windows || []).map((w: any) => ({
        ...w,
        x: convert(w.x),
        y: convert(w.y),
        width: convert(w.width || 120),
        height: convert(w.height || 120),
      })),
      rooms: (analysis.rooms || []).map((r: any) => ({
        ...r,
        vertices: (r.vertices || []).map((v: any) => ({
          x: convert(v.x),
          y: convert(v.y),
        })),
      })),
      imageWidth: convert(analysis.imageWidth || 0),
      imageHeight: convert(analysis.imageHeight || 0),
      analysisConfidence: analysis.analysisConfidence || 0.5,
    };
  };

  const handleUpdateAnalysis = useCallback((updatedAnalysis: FloorPlanAnalysis) => {
    updateState({ analysis: updatedAnalysis });
  }, [updateState]);

  const handleComplete = useCallback(() => {
    if (state.analysis) {
      onComplete(state.analysis, state.pixelsPerCm, {
        wallThickness: state.defaultWallThickness,
      });
      onOpenChange(false);
      // Reset state
      setState(initialState);
      setCurrentStep(0);
    }
  }, [state.analysis, state.pixelsPerCm, state.defaultWallThickness, onComplete, onOpenChange]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      // If going back from processing, reset processing state
      if (currentStep === 4) {
        abortControllerRef.current?.abort();
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        updateState({
          processingStatus: 'idle',
          processingProgress: 0,
          processingError: null,
        });
      }
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, updateState]);

  const handleRetry = useCallback(() => {
    updateState({
      processingStatus: 'idle',
      processingProgress: 0,
      processingError: null,
    });
    processImage();
  }, [processImage, updateState]);

  const handleClose = useCallback(() => {
    // Cleanup
    abortControllerRef.current?.abort();
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    onOpenChange(false);
    setState(initialState);
    setCurrentStep(0);
  }, [onOpenChange]);

  const canGoBack = currentStep > 0 && state.processingStatus !== 'processing';

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BlueprintUploadStep onUpload={handleImageUpload} />;
      case 1:
        return (
          <BlueprintNormalizeStep
            imageUrl={state.originalImage!}
            onComplete={handleNormalize}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <BlueprintScaleStep
            imageUrl={state.normalizedImage!}
            onComplete={handleScaleCalibration}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <BlueprintSettingsStep
            defaultWallThickness={state.defaultWallThickness}
            detectDoors={state.detectDoors}
            detectWindows={state.detectWindows}
            onComplete={handleSettingsComplete}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <BlueprintProcessingStep
            status={state.processingStatus}
            progress={state.processingProgress}
            error={state.processingError}
            stage={state.processingStage}
            onRetry={handleRetry}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <BlueprintReviewStep
            imageUrl={state.normalizedImage!}
            analysis={state.analysis!}
            pixelsPerCm={state.pixelsPerCm}
            onComplete={handleComplete}
            onBack={handleBack}
            onUpdateAnalysis={handleUpdateAnalysis}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg">Import Floor Plan from Image</DialogTitle>
          
          {/* Step indicator */}
          <div className="flex items-center justify-between mt-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;
              const isDisabled = index > currentStep;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isComplete
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`text-xs ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                  </div>
                  
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        index < currentStep ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

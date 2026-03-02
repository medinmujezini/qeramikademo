import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, RefreshCw, ChevronLeft, CheckCircle2 } from 'lucide-react';

interface BlueprintProcessingStepProps {
  status: 'idle' | 'processing' | 'complete' | 'error';
  progress: number;
  error: string | null;
  stage: string;
  onRetry: () => void;
  onBack: () => void;
}

const STAGE_STEPS = [
  { key: 'prepare', label: 'Preparing image', threshold: 0 },
  { key: 'send', label: 'Sending to AI', threshold: 15 },
  { key: 'detect', label: 'Detecting elements', threshold: 40 },
  { key: 'finalize', label: 'Finalizing', threshold: 75 },
];

export const BlueprintProcessingStep: React.FC<BlueprintProcessingStepProps> = ({
  status,
  progress,
  error,
  stage,
  onRetry,
  onBack,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Elapsed time counter
  useEffect(() => {
    if (status !== 'processing') {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getCurrentStepIndex = () => {
    for (let i = STAGE_STEPS.length - 1; i >= 0; i--) {
      if (progress >= STAGE_STEPS[i].threshold) {
        return i;
      }
    }
    return 0;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      {status === 'processing' && (
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Animated icon */}
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          </div>
          
          {/* Title and stage */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Analyzing Floor Plan</h3>
            <p className="text-muted-foreground">{stage}</p>
          </div>
          
          {/* Stage steps indicator */}
          <div className="flex justify-between items-center px-2">
            {STAGE_STEPS.map((step, index) => {
              const currentIdx = getCurrentStepIndex();
              const isComplete = index < currentIdx;
              const isCurrent = index === currentIdx;
              
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                      isComplete
                        ? 'bg-primary text-primary-foreground'
                        : isCurrent
                        ? 'bg-primary/20 text-primary ring-2 ring-primary ring-offset-2'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={`text-xs ${isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress}%</span>
              <span>Elapsed: {formatTime(elapsedTime)}</span>
            </div>
          </div>
          
          {/* Helper text */}
          <p className="text-xs text-muted-foreground">
            This typically takes 30-60 seconds. You can go back to adjust settings if needed.
          </p>
          
          {/* Back button (only if not too far in) */}
          {progress < 40 && (
            <Button variant="ghost" size="sm" onClick={onBack} className="mt-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Cancel and go back
            </Button>
          )}
        </div>
      )}
      
      {status === 'error' && (
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Analysis Failed</h3>
            <p className="text-muted-foreground">{error || 'An unexpected error occurred'}</p>
          </div>
          
          {/* Troubleshooting tips */}
          <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
            <p className="font-medium">Troubleshooting tips:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Use a clearer, higher contrast image</li>
              <li>Ensure walls are clearly visible</li>
              <li>Remove excessive furniture or annotations</li>
              <li>Try a simpler floor plan first</li>
            </ul>
          </div>
          
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {status === 'complete' && (
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Analysis Complete!</h3>
            <p className="text-muted-foreground">Preparing review...</p>
          </div>
        </div>
      )}
    </div>
  );
};

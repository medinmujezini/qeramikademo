import React, { useCallback, useState } from 'react';
import { Upload, Image, FileImage, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FloorPlanUploaderProps {
  onImageUploaded: (imageDataUrl: string, file: File) => void;
  isProcessing?: boolean;
}

export const FloorPlanUploader: React.FC<FloorPlanUploaderProps> = ({
  onImageUploaded,
  isProcessing = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, WebP, or PDF file');
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB');
      return;
    }

    // For PDFs, we'd need a PDF-to-image conversion (future enhancement)
    if (file.type === 'application/pdf') {
      setError('PDF support coming soon. Please convert to PNG or JPG first.');
      return;
    }

    // Read and validate image
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      
      // Validate image dimensions
      const img = new window.Image();
      img.onload = () => {
        if (img.width > 8000 || img.height > 8000) {
          setError('Image dimensions must be less than 8000x8000 pixels');
          return;
        }
        
        setPreviewUrl(dataUrl);
        onImageUploaded(dataUrl, file);
      };
      img.onerror = () => {
        setError('Failed to load image. Please try another file.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  }, [onImageUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClear = useCallback(() => {
    setPreviewUrl(null);
    setError(null);
  }, []);

  if (previewUrl) {
    return (
      <Card className="relative">
        <CardContent className="p-4">
          <div className="relative">
            <img 
              src={previewUrl} 
              alt="Uploaded floor plan" 
              className="w-full h-auto max-h-[400px] object-contain rounded-md border"
            />
            {!isProcessing && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Processing...</span>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Floor plan uploaded successfully
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer",
          "flex flex-col items-center justify-center gap-4 min-h-[300px]",
          isDragOver 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <div className="p-4 rounded-full bg-muted">
          <FileImage className="h-10 w-10 text-muted-foreground" />
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-lg">Upload Floor Plan</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Drag and drop your floor plan image here, or click to browse.
            Supports PNG, JPG, and WebP formats.
          </p>
        </div>

        <label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileInput}
            className="hidden"
          />
          <Button variant="secondary" asChild className="cursor-pointer">
            <span>
              <Upload className="h-4 w-4 mr-2" />
              Browse Files
            </span>
          </Button>
        </label>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Tips for best results:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>Use a clean, high-resolution scan or photo</li>
          <li>Ensure the floor plan is not skewed or rotated</li>
          <li>Plans with clear wall lines work best</li>
          <li>Architectural blueprints and sketches are supported</li>
        </ul>
      </div>
    </div>
  );
};

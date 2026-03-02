import React, { useCallback, useState } from 'react';
import { Upload, ImageIcon, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlueprintUploadStepProps {
  onUpload: (imageDataUrl: string, width: number, height: number) => void;
}

export const BlueprintUploadStep: React.FC<BlueprintUploadStepProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        onUpload(dataUrl, img.width, img.height);
        setIsLoading(false);
      };
      img.onerror = () => {
        setIsLoading(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div
        className={`w-full max-w-lg p-12 border-2 border-dashed rounded-xl transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          {isLoading ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-muted-foreground">Loading image...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-1">Upload Floor Plan Image</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your floor plan image, or click to browse
                </p>
              </div>
              
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="blueprint-upload"
              />
              <label htmlFor="blueprint-upload">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>
                    <FileImage className="h-4 w-4 mr-2" />
                    Choose File
                  </span>
                </Button>
              </label>
              
              <p className="text-xs text-muted-foreground mt-4">
                Supported formats: PNG, JPG, JPEG, WEBP
              </p>
            </>
          )}
        </div>
      </div>
      
      <div className="mt-8 max-w-lg">
        <h4 className="text-sm font-medium mb-2">Tips for best results:</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Use high-resolution images (at least 1000px wide)</li>
          <li>• Ensure the floor plan is clearly visible with good contrast</li>
          <li>• Architectural blueprints and hand-drawn sketches work well</li>
          <li>• The image should show wall outlines clearly</li>
        </ul>
      </div>
    </div>
  );
};

import React, { useState, useCallback, useRef } from 'react';
import { Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onUpload: (file: File, img: HTMLImageElement) => void;
}

export const UploadStep: React.FC<Props> = ({ onUpload }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      onUpload(file, img);
    };
    img.src = url;
  }, [onUpload]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handle(f);
        }}
        className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Drop a floor plan image</h3>
        <p className="text-sm text-muted-foreground mb-6">
          JPG, PNG or WebP. Top-down orientation works best.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
        />
        <Button onClick={() => inputRef.current?.click()}>Select file</Button>
      </div>
    </div>
  );
};

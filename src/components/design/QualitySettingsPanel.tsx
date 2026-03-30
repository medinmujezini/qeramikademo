/**
 * Quality Settings Panel
 * Real-time controls for GI, shadow softness, and post-processing
 */

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, Sparkles, Sun, Palette, Film, RotateCcw } from 'lucide-react';
export interface QualitySettings {
  // SSAO
  ssaoEnabled: boolean;
  ssaoRadius: number;
  ssaoIntensity: number;
  ssaoSamples: number;
  ssaoBias?: number;
  ssaoBlurSharpness: number;
  
  // Shadows
  shadowSoftness: number;
  shadowIntensity: number;
  shadowDarkness: number;
  contactShadowsEnabled: boolean;
  contactShadowsIntensity: number;
  
  // Lighting
  skyLightIntensity: number;
  
  // SSR
  ssrEnabled?: boolean;
  
  // Bloom
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  
  // Fake Mobile Bloom
  fakeMobileBloomEnabled: boolean;
  fakeMobileBloomIntensity: number;
  
  // Color Grading
  colorGradingEnabled: boolean;
  contrast: number;
  saturation: number;
  brightness: number;
  
  // Film Effects
  vignetteEnabled: boolean;
  vignetteIntensity: number;
  grainEnabled: boolean;
  grainIntensity: number;
}

export const DEFAULT_QUALITY_SETTINGS: QualitySettings = {
  ssaoEnabled: true,
  ssaoRadius: 0.5,
  ssaoIntensity: 0.8,
  ssaoSamples: 9999,
  ssaoBias: 0.025,
  ssaoBlurSharpness: 4.0,
  
  shadowSoftness: 1.5,
  shadowIntensity: 1.0,
  shadowDarkness: 0.15,
  contactShadowsEnabled: true,
  contactShadowsIntensity: 0.4,
  
  skyLightIntensity: 1.2,
  
  ssrEnabled: false,
  
  // All post-processing effects disabled by default for stability
  bloomEnabled: false,
  bloomIntensity: 0.5,
  bloomThreshold: 1.0,
  
  fakeMobileBloomEnabled: false,
  fakeMobileBloomIntensity: 0.3,
  
  colorGradingEnabled: false,
  contrast: 1.0,
  saturation: 1.0,
  brightness: 1.0,
  
  vignetteEnabled: false,
  vignetteIntensity: 0.3,
  grainEnabled: false,
  grainIntensity: 0.05,
};

interface QualitySettingsPanelProps {
  settings: QualitySettings;
  onChange: (settings: QualitySettings) => void;
  disabled?: boolean;
}

export const QualitySettingsPanel: React.FC<QualitySettingsPanelProps> = ({
  settings,
  onChange,
  disabled = false,
}) => {
  const update = <K extends keyof QualitySettings>(key: K, value: QualitySettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleReset = () => {
    onChange(DEFAULT_QUALITY_SETTINGS);
  };

  return (
    <div className="space-y-2 p-3 text-sm text-foreground">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Quality Settings
        </h3>
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={disabled} className="h-7 px-2">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* SSAO Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
            <span className="flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5" />
              Ambient Occlusion
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 px-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Enable SSAO</Label>
            <Switch 
              checked={settings.ssaoEnabled} 
              onCheckedChange={(v) => update('ssaoEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Radius</Label>
              <span className="text-xs text-muted-foreground">{settings.ssaoRadius.toFixed(1)}</span>
            </div>
            <Slider
              value={[settings.ssaoRadius]}
              onValueChange={([v]) => update('ssaoRadius', v)}
              min={0.2}
              max={3.0}
              step={0.1}
              disabled={disabled || !settings.ssaoEnabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.ssaoIntensity.toFixed(1)}</span>
            </div>
            <Slider
              value={[settings.ssaoIntensity]}
              onValueChange={([v]) => update('ssaoIntensity', v)}
              min={0.1}
              max={2.0}
              step={0.1}
              disabled={disabled || !settings.ssaoEnabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Samples</Label>
              <Input
                type="number"
                value={settings.ssaoSamples}
                onChange={(e) => {
                  const val = Math.max(4, Math.min(99999, parseInt(e.target.value) || 9999));
                  update('ssaoSamples', val);
                }}
                min={4}
                max={99999}
                step={4}
                disabled={disabled || !settings.ssaoEnabled}
                className="w-24 h-6 text-xs text-right px-1"
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Denoise</Label>
              <span className="text-xs text-muted-foreground">{settings.ssaoBlurSharpness.toFixed(0)}</span>
            </div>
            <Slider
              value={[settings.ssaoBlurSharpness]}
              onValueChange={([v]) => update('ssaoBlurSharpness', v)}
              min={1}
              max={20}
              step={1}
              disabled={disabled || !settings.ssaoEnabled}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Shadows Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
            <span className="flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5" />
              Shadows
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 px-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Shadow Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.shadowIntensity.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.shadowIntensity]}
              onValueChange={([v]) => update('shadowIntensity', v)}
              min={0.5}
              max={2.0}
              step={0.1}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Shadow Darkness</Label>
              <span className="text-xs text-muted-foreground">{settings.shadowDarkness.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.shadowDarkness]}
              onValueChange={([v]) => update('shadowDarkness', v)}
              min={0.0}
              max={0.5}
              step={0.01}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Shadow Softness</Label>
              <span className="text-xs text-muted-foreground">{settings.shadowSoftness.toFixed(1)}</span>
            </div>
            <Slider
              value={[settings.shadowSoftness]}
              onValueChange={([v]) => update('shadowSoftness', v)}
              min={0.5}
              max={5.0}
              step={0.1}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Contact Shadows</Label>
            <Switch 
              checked={settings.contactShadowsEnabled} 
              onCheckedChange={(v) => update('contactShadowsEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Contact Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.contactShadowsIntensity.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.contactShadowsIntensity]}
              onValueChange={([v]) => update('contactShadowsIntensity', v)}
              min={0.1}
              max={0.8}
              step={0.05}
              disabled={disabled || !settings.contactShadowsEnabled}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Post-Processing Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              Color & Bloom
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 px-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Sky Light Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.skyLightIntensity.toFixed(1)}</span>
            </div>
            <Slider
              value={[settings.skyLightIntensity]}
              onValueChange={([v]) => update('skyLightIntensity', v)}
              min={0.0}
              max={3.0}
              step={0.1}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Screen Reflections</Label>
            <Switch 
              checked={settings.ssrEnabled} 
              onCheckedChange={(v) => update('ssrEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Bloom</Label>
            <Switch 
              checked={settings.bloomEnabled} 
              onCheckedChange={(v) => update('bloomEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Bloom Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.bloomIntensity.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.bloomIntensity]}
              onValueChange={([v]) => update('bloomIntensity', v)}
              min={0.1}
              max={1.5}
              step={0.05}
              disabled={disabled || !settings.bloomEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Fake Mobile Bloom</Label>
            <Switch 
              checked={settings.fakeMobileBloomEnabled} 
              onCheckedChange={(v) => update('fakeMobileBloomEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Mobile Bloom Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.fakeMobileBloomIntensity.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.fakeMobileBloomIntensity]}
              onValueChange={([v]) => update('fakeMobileBloomIntensity', v)}
              min={0.1}
              max={1.0}
              step={0.05}
              disabled={disabled || !settings.fakeMobileBloomEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Color Grading</Label>
            <Switch 
              checked={settings.colorGradingEnabled} 
              onCheckedChange={(v) => update('colorGradingEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Contrast</Label>
              <span className="text-xs text-muted-foreground">{settings.contrast.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.contrast]}
              onValueChange={([v]) => update('contrast', v)}
              min={0.8}
              max={1.5}
              step={0.05}
              disabled={disabled || !settings.colorGradingEnabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Saturation</Label>
              <span className="text-xs text-muted-foreground">{settings.saturation.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.saturation]}
              onValueChange={([v]) => update('saturation', v)}
              min={0.5}
              max={1.5}
              step={0.05}
              disabled={disabled || !settings.colorGradingEnabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Brightness</Label>
              <span className="text-xs text-muted-foreground">{settings.brightness.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.brightness]}
              onValueChange={([v]) => update('brightness', v)}
              min={0.8}
              max={1.3}
              step={0.05}
              disabled={disabled || !settings.colorGradingEnabled}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Film Effects Section */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
            <span className="flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" />
              Film Effects
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 px-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Vignette</Label>
            <Switch 
              checked={settings.vignetteEnabled} 
              onCheckedChange={(v) => update('vignetteEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Vignette Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.vignetteIntensity.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.vignetteIntensity]}
              onValueChange={([v]) => update('vignetteIntensity', v)}
              min={0.1}
              max={0.8}
              step={0.05}
              disabled={disabled || !settings.vignetteEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Film Grain</Label>
            <Switch 
              checked={settings.grainEnabled} 
              onCheckedChange={(v) => update('grainEnabled', v)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Grain Intensity</Label>
              <span className="text-xs text-muted-foreground">{settings.grainIntensity.toFixed(3)}</span>
            </div>
            <Slider
              value={[settings.grainIntensity]}
              onValueChange={([v]) => update('grainIntensity', v)}
              min={0.005}
              max={0.1}
              step={0.005}
              disabled={disabled || !settings.grainEnabled}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default QualitySettingsPanel;

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, Link } from 'lucide-react';

interface SofaScoreWidgetProps {
  url: string | undefined;
  onSave: (url: string) => void;
  cropTop?: number;
  cropHeight?: number;
  onCropChange?: (cropTop: number, cropHeight: number) => void;
  /** If true, only renders the iframe (no input) */
  displayOnly?: boolean;
}

/** Extract the src URL from a pasted <iframe> tag, or return the raw string if it's already a URL */
function extractSofaScoreUrl(input: string): string {
  const trimmed = input.trim();
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (srcMatch) return srcMatch[1];
  return trimmed;
}

/** Ensure the SofaScore URL uses dark theme */
function ensureDarkTheme(url: string): string {
  if (!url) return url;
  if (url.includes('widgetTheme=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return url + separator + 'widgetTheme=dark';
}

const DEFAULT_CROP_TOP = 0;
const DEFAULT_CROP_HEIGHT = 120;

export function SofaScoreWidget({ url, onSave, cropTop: propCropTop, cropHeight: propCropHeight, onCropChange, displayOnly }: SofaScoreWidgetProps) {
  const [editValue, setEditValue] = useState(url || '');
  const [isEditing, setIsEditing] = useState(false);
  const [localCropTop, setLocalCropTop] = useState(propCropTop ?? DEFAULT_CROP_TOP);
  const [localCropHeight, setLocalCropHeight] = useState(propCropHeight ?? DEFAULT_CROP_HEIGHT);

  const effectiveCropTop = propCropTop ?? localCropTop;
  const effectiveCropHeight = propCropHeight ?? localCropHeight;

  const handleSave = (raw: string) => {
    const extracted = extractSofaScoreUrl(raw);
    setEditValue(extracted);
    if (extracted !== (url || '')) {
      onSave(extracted);
    }
    setIsEditing(false);
  };

  const handleClear = () => {
    setEditValue('');
    onSave('');
    setIsEditing(false);
  };

  const handleCropTopChange = (value: number[]) => {
    const v = value[0];
    setLocalCropTop(v);
    onCropChange?.(v, localCropHeight);
  };

  const handleCropHeightChange = (value: number[]) => {
    const v = value[0];
    setLocalCropHeight(v);
    onCropChange?.(localCropTop, v);
  };

  const iframeSrc = ensureDarkTheme(url || editValue);

  // Shared iframe renderer – crop sides by scaling up and hiding overflow
  const renderIframe = (ct: number, ch: number, interactive = false) => (
    <div className="relative group overflow-hidden rounded-lg bg-card" style={{ height: ch }}>
      <iframe
        src={iframeSrc}
        style={{
          colorScheme: 'normal',
          marginTop: -ct,
          marginLeft: '-16px',
          width: 'calc(100% + 32px)',
          height: 500,
          border: 'none',
        }}
        scrolling="no"
        className={interactive ? '' : 'pointer-events-none'}
      />
    </div>
  );

  // Display-only mode
  if (displayOnly) {
    if (!url) return null;
    return (
      <div className="relative group">
        {renderIframe(effectiveCropTop, effectiveCropHeight)}
        <button
          onClick={() => onSave('')}
          className="absolute top-1 right-1 z-10 h-5 w-5 rounded-full bg-background/80 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link className="h-3 w-3" />
        <span>SofaScore Widget</span>
      </div>

      {!url && !isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Link className="h-3 w-3" />
          <span className="italic">Colar link do widget SofaScore...</span>
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSave(editValue)}
              onFocus={() => setIsEditing(true)}
              placeholder="Cole o link ou o código <iframe> do SofaScore..."
              className="text-xs h-8"
              autoFocus={isEditing && !url}
            />
            {(url || editValue) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>

          {/* Crop controls - only show when there's a URL */}
          {(url || editValue) && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Corte superior</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{localCropTop}px</span>
                </div>
                <Slider
                  value={[localCropTop]}
                  onValueChange={handleCropTopChange}
                  min={0}
                  max={300}
                  step={5}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Altura visível</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{localCropHeight}px</span>
                </div>
                <Slider
                  value={[localCropHeight]}
                  onValueChange={handleCropHeightChange}
                  min={40}
                  max={350}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Live preview */}
              {renderIframe(localCropTop, localCropHeight)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

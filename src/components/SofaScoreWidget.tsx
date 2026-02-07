import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Link } from 'lucide-react';

interface SofaScoreWidgetProps {
  url: string | undefined;
  onSave: (url: string) => void;
  /** If true, only renders the iframe (no input) */
  displayOnly?: boolean;
}

/** Extract the src URL from a pasted <iframe> tag, or return the raw string if it's already a URL */
function extractSofaScoreUrl(input: string): string {
  const trimmed = input.trim();
  // If user pasted an <iframe ...> tag, extract the src attribute
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (srcMatch) return srcMatch[1];
  return trimmed;
}

export function SofaScoreWidget({ url, onSave, displayOnly }: SofaScoreWidgetProps) {
  const [editValue, setEditValue] = useState(url || '');
  const [isEditing, setIsEditing] = useState(false);

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

  // Display-only mode: just the iframe
  if (displayOnly) {
    if (!url) return null;
    return (
      <div className="relative group overflow-hidden" style={{ height: 80 }}>
        <iframe
          src={url}
          width="100%"
          height="300"
          style={{ colorScheme: 'normal', marginTop: -60 }}
          frameBorder="0"
          scrolling="no"
          className="pointer-events-none"
        />
        {/* Overlay to blend edges with dark theme */}
        <div className="absolute inset-0 pointer-events-none border border-border/10 rounded" />
        <button
          onClick={() => onSave('')}
          className="absolute top-1 right-1 z-10 h-5 w-5 rounded-full bg-background/80 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
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
      )}
    </div>
  );
}

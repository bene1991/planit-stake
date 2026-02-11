import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Link, ExternalLink } from 'lucide-react';

interface RadarFutebolWidgetProps {
  url: string | undefined;
  onSave: (url: string) => void;
}

export function RadarFutebolWidget({ url, onSave }: RadarFutebolWidgetProps) {
  const [editValue, setEditValue] = useState(url || '');
  const [isEditing, setIsEditing] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const handleSave = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed !== (url || '')) {
      onSave(trimmed);
    }
    setEditValue(trimmed);
    setIsEditing(false);
  };

  const handleClear = () => {
    setEditValue('');
    onSave('');
    setIsEditing(false);
    setIframeError(false);
  };

  const displayUrl = url || editValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link className="h-3 w-3" />
        <span>Radar Futebol</span>
      </div>

      {!url && !isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Link className="h-3 w-3" />
          <span className="italic">Colar link do Radar Futebol...</span>
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSave(editValue)}
              onFocus={() => setIsEditing(true)}
              placeholder="Cole o link do Radar Futebol..."
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

          {displayUrl && !iframeError && (
            <div className="relative group overflow-hidden rounded-lg bg-[#0D0D0D]" style={{ height: 400 }}>
              <iframe
                src={displayUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                sandbox="allow-scripts allow-same-origin"
                onError={() => setIframeError(true)}
                onLoad={(e) => {
                  // Some sites block via X-Frame-Options but don't trigger onError
                  // We can't reliably detect this, so we keep the iframe visible
                }}
              />
              <button
                onClick={handleClear}
                className="absolute top-1 right-1 z-10 h-5 w-5 rounded-full bg-background/80 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {displayUrl && iframeError && (
            <div className="flex flex-col items-center gap-2 py-4 px-3 rounded-lg border border-border/40 bg-muted/30">
              <p className="text-xs text-muted-foreground">Não foi possível carregar o iframe.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(displayUrl, '_blank')}
                className="gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Radar Futebol
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

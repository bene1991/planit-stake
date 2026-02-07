import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Link } from 'lucide-react';

interface SofaScoreWidgetProps {
  url: string | undefined;
  onSave: (url: string) => void;
}

export function SofaScoreWidget({ url, onSave }: SofaScoreWidgetProps) {
  const [editValue, setEditValue] = useState(url || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleBlur = () => {
    const trimmed = editValue.trim();
    if (trimmed !== (url || '')) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleClear = () => {
    setEditValue('');
    onSave('');
    setIsEditing(false);
  };

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
            onBlur={handleBlur}
            onFocus={() => setIsEditing(true)}
            placeholder="Cole o link do widget SofaScore..."
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

      {url && (
        <iframe
          src={url}
          width="100%"
          height="286"
          frameBorder="0"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin"
          className="rounded-lg border border-border/30"
        />
      )}
    </div>
  );
}

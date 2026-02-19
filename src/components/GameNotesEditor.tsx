import { useState } from 'react';
import { MessageSquare, Pencil, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface GameNotesEditorProps {
  notes: string | null | undefined;
  onSave: (notes: string) => void;
  compact?: boolean;
}

const MAX_CHARS = 500;

export function GameNotesEditor({ notes, onSave, compact = false }: GameNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(notes || '');

  const handleStartEdit = () => {
    setEditValue(notes || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(notes || '');
    setIsEditing(false);
  };

  const handleSave = () => {
    onSave(editValue.trim());
    setIsEditing(false);
  };

  const remainingChars = MAX_CHARS - editValue.length;

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          <span>Observações</span>
        </div>
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, MAX_CHARS))}
          placeholder={"Ex: Odds pré-live → 1X2: 2.10 / 3.40 / 3.20 | BTTS: 1.85 / 1.95\nNotas sobre o jogo, análise, condições..."}
          className={cn(
            "min-h-[80px] text-sm resize-none",
            compact && "min-h-[60px]"
          )}
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs",
            remainingChars < 50 ? "text-destructive" : "text-muted-foreground"
          )}>
            {remainingChars} caracteres restantes
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-7 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 px-2"
            >
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!notes) {
    return (
      <button
        onClick={handleStartEdit}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-lg hover:bg-secondary/50 border border-dashed border-border/50"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="italic">Adicionar observações / odds pré-live...</span>
        <Pencil className="h-3 w-3 opacity-50" />
      </button>
    );
  }

  return (
    <div className="group">
      <button
        onClick={handleStartEdit}
        className="flex items-start gap-2 text-left w-full py-1"
      >
        <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
        <p className={cn(
          "text-xs text-muted-foreground italic flex-1",
          compact ? "line-clamp-2" : "line-clamp-3"
        )}>
          {notes}
        </p>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
      </button>
    </div>
  );
}

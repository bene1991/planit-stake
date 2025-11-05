import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Target, AlertCircle, Users } from "lucide-react";

interface TimelineEvent {
  time: string;
  team: 'home' | 'away';
  type: 'goal' | 'yellow' | 'red' | 'substitution' | 'shot';
  description: string;
}

interface EventTimelineProps {
  events: TimelineEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'goal':
        return <Target className="h-4 w-4 text-green-500" />;
      case 'yellow':
      case 'red':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'substitution':
        return <Users className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Linha do Tempo</h3>
      
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum evento registrado ainda
            </p>
          ) : (
            events.map((event, index) => (
              <div 
                key={index}
                className={`flex items-start gap-3 ${
                  event.team === 'home' ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  {getIcon(event.type)}
                </div>
                
                <div className={`flex-1 ${event.team === 'away' ? 'text-right' : 'text-left'}`}>
                  <div className="text-xs text-muted-foreground mb-1">{event.time}'</div>
                  <div className="text-sm font-medium">{event.description}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

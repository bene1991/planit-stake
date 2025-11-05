import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface PressureChartProps {
  homeTeam: string;
  awayTeam: string;
  homePossession?: number;
  awayPossession?: number;
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
}

export function PressureChart({
  homeTeam,
  awayTeam,
  homePossession = 50,
  awayPossession = 50,
  homeShots = 0,
  awayShots = 0,
  homeShotsOnTarget = 0,
  awayShotsOnTarget = 0,
}: PressureChartProps) {
  const data = [
    {
      stat: 'Posse',
      home: homePossession,
      away: awayPossession,
    },
    {
      stat: 'Chutes',
      home: homeShots,
      away: awayShots,
    },
    {
      stat: 'Chutes no Alvo',
      home: homeShotsOnTarget,
      away: awayShotsOnTarget,
    },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Pressão do Jogo</h3>
      
      <div className="space-y-6">
        {data.map((item) => (
          <div key={item.stat} className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>{homeTeam}</span>
              <span className="text-muted-foreground">{item.stat}</span>
              <span>{awayTeam}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold w-8 text-right">{item.home}</span>
              
              <div className="flex-1 flex h-6 rounded-full overflow-hidden bg-muted">
                <div 
                  className="bg-primary transition-all duration-500"
                  style={{ width: `${(item.home / (item.home + item.away)) * 100}%` }}
                />
                <div 
                  className="bg-secondary transition-all duration-500"
                  style={{ width: `${(item.away / (item.home + item.away)) * 100}%` }}
                />
              </div>
              
              <span className="text-sm font-semibold w-8 text-left">{item.away}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

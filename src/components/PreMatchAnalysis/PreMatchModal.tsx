import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePreMatchAnalysis } from "@/hooks/usePreMatchAnalysis";
import { StandingsSection } from "./StandingsSection";
import { GoalStatsSection } from "./GoalStatsSection";
import { GoalMinutesSection } from "./GoalMinutesSection";
import { LastMatchesSection } from "./LastMatchesSection";
import { HeadToHeadSection } from "./HeadToHeadSection";
import { PredictionsSection } from "./PredictionsSection";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
}

export function PreMatchModal({ open, onOpenChange, fixtureId, homeTeam, awayTeam }: Props) {
  const { data, loading, error } = usePreMatchAnalysis(open ? fixtureId : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <span className="text-primary">{homeTeam}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="text-destructive">{awayTeam}</span>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando análise...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive text-sm">{error}</div>
        )}

        {!loading && !error && (
          <Tabs defaultValue="predictions" className="w-full">
            <div className="space-y-1 mb-3">
              <TabsList className="w-full grid grid-cols-3 h-8">
                <TabsTrigger value="predictions" className="text-[10px] px-1">Predição</TabsTrigger>
                <TabsTrigger value="standings" className="text-[10px] px-1">Classif.</TabsTrigger>
                <TabsTrigger value="stats" className="text-[10px] px-1">Gols</TabsTrigger>
              </TabsList>
              <TabsList className="w-full grid grid-cols-3 h-8">
                <TabsTrigger value="minutes" className="text-[10px] px-1">Minutagem</TabsTrigger>
                <TabsTrigger value="last" className="text-[10px] px-1">Últimos</TabsTrigger>
                <TabsTrigger value="h2h" className="text-[10px] px-1">H2H</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="predictions">
              <PredictionsSection prediction={data.prediction} homeTeam={homeTeam} awayTeam={awayTeam} />
            </TabsContent>
            <TabsContent value="standings">
              <StandingsSection standings={data.standings} homeTeamId={data.fixtureInfo?.homeTeamId || 0} awayTeamId={data.fixtureInfo?.awayTeamId || 0} />
            </TabsContent>
            <TabsContent value="stats">
              <GoalStatsSection homeStats={data.homeStats} awayStats={data.awayStats} homeTeam={homeTeam} awayTeam={awayTeam} />
            </TabsContent>
            <TabsContent value="minutes">
              <GoalMinutesSection homeStats={data.homeStats} awayStats={data.awayStats} homeTeam={homeTeam} awayTeam={awayTeam} />
            </TabsContent>
            <TabsContent value="last">
              <LastMatchesSection homeMatches={data.homeLastMatches} awayMatches={data.awayLastMatches} homeTeam={homeTeam} awayTeam={awayTeam} homeTeamId={data.fixtureInfo?.homeTeamId || 0} awayTeamId={data.fixtureInfo?.awayTeamId || 0} />
            </TabsContent>
            <TabsContent value="h2h">
              <HeadToHeadSection h2h={data.h2h} homeTeamId={data.fixtureInfo?.homeTeamId || 0} awayTeamId={data.fixtureInfo?.awayTeamId || 0} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { H2HFixture, computeLambdas, poisson } from "@/utils/poisson";
import { cn } from "@/lib/utils";

interface Props {
    homeLastMatches: H2HFixture[] | null;
    awayLastMatches: H2HFixture[] | null;
    homeTeamId: number;
    awayTeamId: number;
}

interface ScoreProb {
    score: string;
    prob: number;
    fairOdd: number;
    homeGoals: number;
    awayGoals: number;
}

export function CorrectScoreSection({ homeLastMatches, awayLastMatches, homeTeamId, awayTeamId }: Props) {
    const analysis = useMemo(() => {
        if (!homeLastMatches?.length || !awayLastMatches?.length) return null;

        const { lambdaHome, lambdaAway, confidence } = computeLambdas(
            homeLastMatches, awayLastMatches, homeTeamId, awayTeamId
        );

        if (lambdaHome === 0 && lambdaAway === 0) return null;

        // Requested scorelines
        const scoresToCalculate = [
            [0, 0], [1, 0], [0, 1], [1, 1],
            [2, 0], [0, 2], [2, 1], [1, 2],
            [2, 2], [3, 0], [0, 3], [3, 1],
            [1, 3], [3, 3]
        ];

        const results: ScoreProb[] = scoresToCalculate.map(([h, a]) => {
            // P(Score HxA) = P(Home scores H) * P(Away scores A)
            const pHome = poisson(h, lambdaHome);
            const pAway = poisson(a, lambdaAway);
            const prob = pHome * pAway;

            return {
                score: `${h}x${a}`,
                prob,
                fairOdd: prob > 0 ? 1 / prob : 999,
                homeGoals: h,
                awayGoals: a
            };
        });

        // Sort by highest probability
        results.sort((a, b) => b.prob - a.prob);

        return {
            results,
            confidence
        };
    }, [homeLastMatches, awayLastMatches, homeTeamId, awayTeamId]);

    if (!analysis) {
        return (
            <div className="text-center py-4 text-xs text-muted-foreground">
                Dados insuficientes para cálculo de Placar Exato
            </div>
        );
    }

    const confidenceColor = {
        Alta: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        Média: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
        Baixa: 'text-red-400 border-red-500/30 bg-red-500/10',
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Target className="h-4 w-4" />
                    Probabilidades Placar Exato
                </h4>
                <Badge variant="outline" className={`text-[10px] ${confidenceColor[analysis.confidence]}`}>
                    {analysis.confidence === 'Alta' ? '📊' : analysis.confidence === 'Média' ? '⚠️' : '❗'} {analysis.confidence}
                </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {analysis.results.map((item, index) => {
                    // Highlight the most likely score
                    const isTopResult = index === 0;

                    return (
                        <div
                            key={item.score}
                            className={cn(
                                "flex flex-col items-center justify-center p-2 rounded-lg border",
                                isTopResult
                                    ? "border-primary/50 bg-primary/10 shadow-[0_0_8px_rgba(var(--primary),0.1)]"
                                    : "border-white/5 bg-[#121A24] hover:bg-white/5 transition-colors"
                            )}
                        >
                            <div className="flex items-center gap-1.5 mb-1 text-base">
                                <span className={cn(
                                    "font-black tabular-nums",
                                    item.homeGoals > item.awayGoals ? "text-emerald-400" : item.homeGoals < item.awayGoals ? "text-red-400" : "text-yellow-400"
                                )}>
                                    {item.homeGoals}
                                </span>
                                <span className="text-muted-foreground text-[10px]">x</span>
                                <span className={cn(
                                    "font-black tabular-nums",
                                    item.homeGoals < item.awayGoals ? "text-emerald-400" : item.homeGoals > item.awayGoals ? "text-red-400" : "text-yellow-400"
                                )}>
                                    {item.awayGoals}
                                </span>
                            </div>

                            <div className="flex flex-col items-center w-full space-y-0.5">
                                <div className="flex items-center justify-between w-full text-[9px]">
                                    <span className="text-muted-foreground">Prob:</span>
                                    <span className={cn(
                                        "font-bold font-mono text-[10px]",
                                        item.prob >= 0.15 ? "text-emerald-400" : item.prob >= 0.08 ? "text-yellow-400" : "text-foreground"
                                    )}>
                                        {(item.prob * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between w-full text-[9px]">
                                    <span className="text-muted-foreground">Odd Justa:</span>
                                    <span className="font-mono text-[10px] opacity-80">
                                        {item.fairOdd > 99 ? '99+' : item.fairOdd.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>


            <p className="text-[10px] text-muted-foreground text-center mt-2 opacity-60">
                Calculado via Distribuição de Poisson com base nos últimos jogos.
            </p>
        </div>
    );
}

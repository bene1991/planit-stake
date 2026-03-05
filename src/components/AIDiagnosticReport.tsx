import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Brain,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Target,
    Shield,
    ArrowRight,
    Loader2,
    ChevronDown,
    ChevronUp,
    Globe,
    Wrench,
    Zap,
    Eye,
    Ban,
    RefreshCcw,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticReport } from '@/hooks/useAIDiagnosticReport';

interface AIDiagnosticReportProps {
    report: DiagnosticReport | null;
    loading: boolean;
    error: string | null;
    onGenerate: () => void;
    onClear: () => void;
    tabLabel: string;
}

const classificationConfig: Record<string, { color: string; bg: string; border: string; icon: any }> = {
    Excelente: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle },
    Bom: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: TrendingUp },
    Regular: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Target },
    Atenção: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertTriangle },
    Crítico: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle },
};

const impactConfig: Record<string, { color: string; bg: string; label: string }> = {
    high: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Alto' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Médio' },
    low: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Baixo' },
};

export function AIDiagnosticReport({ report, loading, error, onGenerate, onClear, tabLabel }: AIDiagnosticReportProps) {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        strengths: true,
        weaknesses: true,
        reds: true,
        leagues: false,
        params: false,
        actions: true,
    });

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // No report yet — show generate button
    if (!report && !loading && !error) {
        return (
            <Card className="border-[#2a3142] bg-gradient-to-br from-[#1a1f2d] to-[#1e2333]">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4 py-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center border border-violet-500/20">
                            <Brain className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Diagnóstico AI</h3>
                            <p className="text-sm text-zinc-500 max-w-md mt-1">
                                Análise completa com IA: padrões de reds, ranking de ligas, sugestões de parâmetros e plano de ação para {tabLabel}.
                            </p>
                        </div>
                        <Button
                            onClick={onGenerate}
                            className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold gap-2"
                        >
                            <Brain className="w-4 h-4" />
                            Gerar Diagnóstico
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Loading state
    if (loading) {
        return (
            <Card className="border-[#2a3142] bg-gradient-to-br from-[#1a1f2d] to-[#1e2333]">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4 py-8">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center border border-violet-500/20 animate-pulse">
                                <Brain className="w-8 h-8 text-violet-400" />
                            </div>
                            <Loader2 className="w-5 h-5 text-violet-400 animate-spin absolute -bottom-1 -right-1" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Analisando dados...</h3>
                            <p className="text-xs text-zinc-500 mt-1">
                                A IA está processando reds, ligas, parâmetros e tendências.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Error state
    if (error) {
        return (
            <Card className="border-red-500/30 bg-[#1a1f2d]">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-3 py-4">
                        <XCircle className="w-10 h-10 text-red-400" />
                        <p className="text-sm text-red-400 font-medium">{error}</p>
                        <Button variant="outline" size="sm" onClick={onGenerate} className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                            <RefreshCcw className="w-3 h-3" /> Tentar novamente
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!report) return null;

    const config = classificationConfig[report.classification] || classificationConfig.Regular;
    const ClassIcon = config.icon;

    return (
        <div className="space-y-3">
            {/* Header Score Card */}
            <Card className={cn("border bg-gradient-to-br from-[#1a1f2d] to-[#1e2333]", config.border)}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center border", config.bg, config.border)}>
                                <span className={cn("text-2xl font-black font-mono", config.color)}>
                                    {report.overallScore}
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <ClassIcon className={cn("w-4 h-4", config.color)} />
                                    <Badge variant="outline" className={cn("text-[10px] font-black", config.color, config.border, config.bg)}>
                                        {report.classification}
                                    </Badge>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1 max-w-md leading-relaxed">{report.summary}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onGenerate}
                                className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
                                title="Regenerar diagnóstico"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClear}
                                className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                                title="Fechar diagnóstico"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Strengths */}
                <Card className="border-emerald-500/20 bg-[#1a1f2d]">
                    <button
                        className="w-full flex items-center justify-between p-3 text-left"
                        onClick={() => toggleSection('strengths')}
                    >
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Pontos Fortes</span>
                        </div>
                        {expandedSections.strengths ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                    </button>
                    {expandedSections.strengths && (
                        <CardContent className="p-3 pt-0 space-y-1.5">
                            {report.strengths.map((s, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                                    <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span>{s}</span>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>

                {/* Weaknesses */}
                <Card className="border-red-500/20 bg-[#1a1f2d]">
                    <button
                        className="w-full flex items-center justify-between p-3 text-left"
                        onClick={() => toggleSection('weaknesses')}
                    >
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-400" />
                            <span className="text-xs font-black text-red-400 uppercase tracking-wider">Pontos de Atenção</span>
                        </div>
                        {expandedSections.weaknesses ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                    </button>
                    {expandedSections.weaknesses && (
                        <CardContent className="p-3 pt-0 space-y-1.5">
                            {report.weaknesses.map((w, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                                    <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                    <span>{w}</span>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            </div>

            {/* Red Deep Dive */}
            {report.redDeepDive && (
                <Card className="border-[#2a3142] bg-[#1a1f2d]">
                    <button
                        className="w-full flex items-center justify-between p-3 text-left"
                        onClick={() => toggleSection('reds')}
                    >
                        <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span className="text-xs font-black text-red-400 uppercase tracking-wider">Análise Profunda dos Reds</span>
                        </div>
                        {expandedSections.reds ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                    </button>
                    {expandedSections.reds && (
                        <CardContent className="p-3 pt-0 space-y-3">
                            {/* Pattern */}
                            <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                                <div className="text-[10px] text-red-400 font-bold uppercase mb-1">Padrão Identificado</div>
                                <p className="text-xs text-zinc-300">{report.redDeepDive.pattern}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Common leagues */}
                                {report.redDeepDive.commonLeagues.length > 0 && (
                                    <div>
                                        <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5">Ligas com mais Reds</div>
                                        <div className="space-y-1">
                                            {report.redDeepDive.commonLeagues.map((l, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                                                    <Globe className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                    <span>{l}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Common criteria */}
                                {report.redDeepDive.commonCriteria.length > 0 && (
                                    <div>
                                        <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5">Critérios Correlacionados</div>
                                        <div className="space-y-1">
                                            {report.redDeepDive.commonCriteria.map((c, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                                                    <Target className="w-3 h-3 text-orange-400 flex-shrink-0" />
                                                    <span>{c}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Recommendation */}
                            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
                                <div className="text-[10px] text-blue-400 font-bold uppercase mb-1">Recomendação</div>
                                <p className="text-xs text-zinc-300">{report.redDeepDive.recommendation}</p>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* League Classification */}
            {report.leagueClassification && (
                <Card className="border-[#2a3142] bg-[#1a1f2d]">
                    <button
                        className="w-full flex items-center justify-between p-3 text-left"
                        onClick={() => toggleSection('leagues')}
                    >
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-black text-blue-400 uppercase tracking-wider">Ranking de Ligas</span>
                            <Badge variant="outline" className="text-[9px] font-mono border-zinc-700 text-zinc-500">
                                {(report.leagueClassification.strong?.length || 0) + (report.leagueClassification.weak?.length || 0) + (report.leagueClassification.insufficient?.length || 0)} ligas
                            </Badge>
                        </div>
                        {expandedSections.leagues ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                    </button>
                    {expandedSections.leagues && (
                        <CardContent className="p-3 pt-0 space-y-3">
                            {/* Strong */}
                            {report.leagueClassification.strong?.length > 0 && (
                                <div>
                                    <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1.5 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Fortes (Manter)
                                    </div>
                                    <div className="space-y-1">
                                        {report.leagueClassification.strong.map((l, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs bg-emerald-500/5 rounded px-2 py-1.5">
                                                <span className="text-white font-medium flex-shrink-0">{l.name}</span>
                                                <span className="text-zinc-500">— {l.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Weak */}
                            {report.leagueClassification.weak?.length > 0 && (
                                <div>
                                    <div className="text-[10px] text-red-400 font-bold uppercase mb-1.5 flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> Fracas (Ação necessária)
                                    </div>
                                    <div className="space-y-1">
                                        {report.leagueClassification.weak.map((l, i) => (
                                            <div key={i} className="flex items-start justify-between text-xs bg-red-500/5 rounded px-2 py-1.5">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-white font-medium flex-shrink-0">{l.name}</span>
                                                    <span className="text-zinc-500">— {l.reason}</span>
                                                </div>
                                                <Badge variant="outline" className={cn("text-[9px] font-bold flex-shrink-0 ml-2",
                                                    l.action === 'block' ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                                                )}>
                                                    {l.action === 'block' ? <Ban className="w-2.5 h-2.5 mr-1" /> : <Eye className="w-2.5 h-2.5 mr-1" />}
                                                    {l.action === 'block' ? 'Bloquear' : 'Monitorar'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Insufficient */}
                            {report.leagueClassification.insufficient?.length > 0 && (
                                <div>
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 flex items-center gap-1">
                                        <FileText className="w-3 h-3" /> Dados Insuficientes
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {report.leagueClassification.insufficient.map((l, i) => (
                                            <Badge key={i} variant="outline" className="text-[9px] text-zinc-500 border-zinc-700" title={l.reason}>
                                                {l.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Parameter Suggestions */}
            {report.parameterSuggestions?.length > 0 && (
                <Card className="border-[#2a3142] bg-[#1a1f2d]">
                    <button
                        className="w-full flex items-center justify-between p-3 text-left"
                        onClick={() => toggleSection('params')}
                    >
                        <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-yellow-400" />
                            <span className="text-xs font-black text-yellow-400 uppercase tracking-wider">Sugestões de Parâmetros</span>
                            <Badge variant="outline" className="text-[9px] font-mono border-zinc-700 text-zinc-500">
                                {report.parameterSuggestions.length}
                            </Badge>
                        </div>
                        {expandedSections.params ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                    </button>
                    {expandedSections.params && (
                        <CardContent className="p-3 pt-0">
                            <div className="space-y-2">
                                {report.parameterSuggestions.map((s, i) => {
                                    const impact = impactConfig[s.impact] || impactConfig.low;
                                    return (
                                        <div key={i} className="bg-[#1e2333] border border-[#2a3142] rounded-lg p-3 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white">{s.param}</span>
                                                <Badge variant="outline" className={cn("text-[9px] font-bold", impact.color, impact.bg, `border-${s.impact === 'high' ? 'red' : s.impact === 'medium' ? 'yellow' : 'blue'}-500/30`)}>
                                                    Impacto {impact.label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-mono">
                                                <span className="text-red-400 line-through opacity-60">{s.current}</span>
                                                <ArrowRight className="w-3 h-3 text-zinc-600" />
                                                <span className="text-emerald-400 font-bold">{s.suggested}</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500">{s.reason}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Action Plan */}
            {report.actionPlan?.length > 0 && (
                <Card className="border-violet-500/20 bg-[#1a1f2d]">
                    <button
                        className="w-full flex items-center justify-between p-3 text-left"
                        onClick={() => toggleSection('actions')}
                    >
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-violet-400" />
                            <span className="text-xs font-black text-violet-400 uppercase tracking-wider">Plano de Ação</span>
                        </div>
                        {expandedSections.actions ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                    </button>
                    {expandedSections.actions && (
                        <CardContent className="p-3 pt-0 space-y-1.5">
                            {report.actionPlan.map((a, i) => (
                                <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                                    <div className="w-5 h-5 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-[10px] font-black text-violet-400">{i + 1}</span>
                                    </div>
                                    <span className="leading-relaxed">{a}</span>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}

import { useState } from "react";
import { FlaskConical, RefreshCw, Sparkles } from "lucide-react";
import { useMethodAnalysis, MethodAnalysisData } from "@/hooks/useMethodAnalysis";
import { MethodAnalysisCard } from "@/components/MethodAnalysis/MethodAnalysisCard";
import { MethodAnalysisDetail } from "@/components/MethodAnalysis/MethodAnalysisDetail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MethodAnalysis = () => {
  const { analysisData, loading, methods } = useMethodAnalysis();
  const [selectedMethod, setSelectedMethod] = useState<MethodAnalysisData | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{
    action: string;
    explanation: string;
  } | null>(null);

  const handleAIAnalysis = async (method: MethodAnalysisData) => {
    setAiAnalyzing(true);
    setAiRecommendation(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-method', {
        body: { methodData: method }
      });

      if (error) throw error;

      if (data?.recommendation) {
        setAiRecommendation(data.recommendation);
        toast.success('Análise de IA concluída!');
      }
    } catch (error) {
      console.error('AI Analysis error:', error);
      toast.error('Erro ao gerar análise de IA');
    } finally {
      setAiAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Análise de Método</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Análise de Método</h1>
        </div>
        <div className="text-center py-16 bg-card rounded-xl border border-border/30">
          <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum método cadastrado</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Cadastre métodos na página de Banca para começar a analisá-los aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Análise de Método</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg">
          Avalie a qualidade e viabilidade dos seus métodos de trading com análise estatística e IA.
        </p>
      </div>

      {/* Method Cards Grid */}
      {!selectedMethod && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {analysisData.map(method => (
            <MethodAnalysisCard
              key={method.methodId}
              data={method}
              onClick={() => setSelectedMethod(method)}
            />
          ))}
        </div>
      )}

      {/* Method Detail View */}
      {selectedMethod && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedMethod(null);
                setAiRecommendation(null);
              }}
            >
              ← Voltar para lista
            </Button>
            <Button
              onClick={() => handleAIAnalysis(selectedMethod)}
              disabled={aiAnalyzing}
              className="bg-gradient-neon hover:shadow-glow-strong"
            >
              {aiAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Análise de IA
                </>
              )}
            </Button>
          </div>

          <MethodAnalysisDetail
            data={selectedMethod}
            aiRecommendation={aiRecommendation}
            aiLoading={aiAnalyzing}
          />
        </div>
      )}
    </div>
  );
};

export default MethodAnalysis;

import { useLay1x0 } from '@/contexts/Lay1x0Context';

export { type Lay1x0Analysis } from '@/contexts/Lay1x0Context';

export const useLay1x0Analyses = () => {
    const {
        analyses,
        metrics,
        loading,
        error,
        saveAnalysis,
        resolveAnalysis,
        deleteAnalysis,
        updateOdd,
        unresolveAnalysis,
        fetchAnalyses
    } = useLay1x0();

    return {
        analyses,
        metrics,
        loading,
        error,
        saveAnalysis,
        resolveAnalysis,
        deleteAnalysis,
        updateOdd,
        unresolveAnalysis,
        refetch: fetchAnalyses
    };
};

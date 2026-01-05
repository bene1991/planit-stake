interface ProfitParams {
  stakeValue: number;
  odd: number;
  operationType: 'Back' | 'Lay';
  result: 'Green' | 'Red';
  commissionRate?: number;
}

export const calculateProfit = (params: ProfitParams): number => {
  const { stakeValue, odd, operationType, result, commissionRate = 0.045 } = params;
  
  if (!stakeValue || !odd || stakeValue <= 0 || odd <= 1) {
    return 0;
  }
  
  if (operationType === 'Back') {
    if (result === 'Green') {
      // Ganho: stake * (odd - 1), menos comissão
      return stakeValue * (odd - 1) * (1 - commissionRate);
    } else {
      // Perda total do stake
      return -stakeValue;
    }
  } else { // Lay
    if (result === 'Green') {
      // Ganho: stake (responsabilidade), menos comissão
      return stakeValue * (1 - commissionRate);
    } else {
      // Perda: stake * (odd - 1)
      return -stakeValue * (odd - 1);
    }
  }
};

// Preview do lucro potencial antes de confirmar o resultado
export const calculatePotentialProfit = (
  stakeValue: number,
  odd: number,
  operationType: 'Back' | 'Lay',
  commissionRate: number = 0.045
): { green: number; red: number } => {
  if (!stakeValue || !odd || stakeValue <= 0 || odd <= 1) {
    return { green: 0, red: 0 };
  }

  if (operationType === 'Back') {
    return {
      green: stakeValue * (odd - 1) * (1 - commissionRate),
      red: -stakeValue
    };
  } else { // Lay
    return {
      green: stakeValue * (1 - commissionRate),
      red: -stakeValue * (odd - 1)
    };
  }
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

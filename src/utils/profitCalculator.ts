interface ProfitParams {
  stakeValue: number;
  odd: number;
  operationType: 'Back' | 'Lay';
  result: 'Green' | 'Red' | 'Void';
  commissionRate?: number;
}

export const calculateProfit = (params: ProfitParams): number => {
  const { stakeValue, odd, operationType, result, commissionRate = 0.045 } = params;
  
  if (result === 'Void') return 0;
  
  if (!stakeValue || !odd || stakeValue <= 0 || odd <= 1.01) {
    return 0;
  }
  
  if (operationType === 'Back') {
    if (result === 'Green') {
      return +(stakeValue * (odd - 1) * (1 - commissionRate)).toFixed(2);
    } else {
      return -stakeValue;
    }
  } else { // Lay - stakeValue = responsabilidade
    const stakeLay = stakeValue / (odd - 1);
    if (result === 'Green') {
      return +(stakeLay * (1 - commissionRate)).toFixed(2);
    } else {
      return -stakeValue;
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
  if (!stakeValue || !odd || stakeValue <= 0 || odd <= 1.01) {
    return { green: 0, red: 0 };
  }

  if (operationType === 'Back') {
    return {
      green: +(stakeValue * (odd - 1) * (1 - commissionRate)).toFixed(2),
      red: -stakeValue
    };
  } else { // Lay - stakeValue = responsabilidade
    const stakeLay = stakeValue / (odd - 1);
    return {
      green: +(stakeLay * (1 - commissionRate)).toFixed(2),
      red: -stakeValue
    };
  }
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// src/lib/amm.ts

export interface MarketState {
  p_initial: number;
  i_initial: number;
  pool_yes: number;
  pool_no: number;
}

export interface PayoutResult {
  userId: string;
  payoutAmount: number;
}

export interface BetRecord {
  id: string;
  userId: string;
  amount: number;
  outcome: 'Yes' | 'No';
  probAtTime: number; // The probability right after the bet was placed
}

/**
 * Calculates the new probability of the market resolving to "Yes" based on the WPAM model.
 * WPAM: P_new = (P_initial * I_initial + A_YES) / (I_initial + A_YES + A_NO)
 */
export function calculateProbability(state: MarketState): number {
  const { p_initial, i_initial, pool_yes, pool_no } = state;
  const numerator = p_initial * i_initial + pool_yes;
  const denominator = i_initial + pool_yes + pool_no;
  
  if (denominator === 0) return p_initial;
  return numerator / denominator;
}

/**
 * DBPM (Divergence-Based Payout Model)
 * Rewards users based on how far their bet's probability p_i was from the final market resolution probability R.
 * 
 * @param bets The array of all bets placed on the market
 * @param resolutionProb The final resolution probability (e.g. 1 for YES, 0 for NO, or anything in between)
 */
export function calculatePayouts(bets: BetRecord[], resolutionProb: number): PayoutResult[] {
  // 1. Divide total share pool into YES and NO pools
  const totalSharesPool = bets.reduce((sum, bet) => sum + bet.amount, 0);
  
  // Using simple rounding for the pools as per DBPM specs
  const S_YES = Math.round(totalSharesPool * resolutionProb);
  const S_NO = Math.round(totalSharesPool * (1 - resolutionProb));

  // 2. Individual Payout Calculation (Course Payouts)
  // d_i = |R - p_i|
  // C_i = d_i * b_i

  let C_YES_TOTAL = 0;
  let C_NO_TOTAL = 0;

  const coursePayouts = bets.map(bet => {
    const d_i = Math.abs(resolutionProb - bet.probAtTime);
    const C_i = d_i * bet.amount;
    
    if (bet.outcome === 'Yes') {
      C_YES_TOTAL += C_i;
    } else {
      C_NO_TOTAL += C_i;
    }

    return { ...bet, C_i };
  });

  // 3. Normalization Factors
  // F_YES = min(1, S_YES / C_YES_TOTAL)
  // F_NO = min(1, S_NO / C_NO_TOTAL)
  
  const F_YES = C_YES_TOTAL > 0 ? Math.min(1, S_YES / C_YES_TOTAL) : 0;
  const F_NO = C_NO_TOTAL > 0 ? Math.min(1, S_NO / C_NO_TOTAL) : 0;

  // 4. Final Payouts
  const userPayouts: Record<string, number> = {};

  coursePayouts.forEach(bet => {
    let finalPayout = 0;
    if (bet.outcome === 'Yes') {
      finalPayout = bet.C_i * F_YES;
    } else {
      finalPayout = bet.C_i * F_NO;
    }

    // Accumulate per user
    if (!userPayouts[bet.userId]) {
      userPayouts[bet.userId] = 0;
    }
    userPayouts[bet.userId] += finalPayout;
  });

  return Object.entries(userPayouts).map(([userId, payoutAmount]) => ({
    userId,
    payoutAmount: Math.round(payoutAmount) // returning integers
  }));
}

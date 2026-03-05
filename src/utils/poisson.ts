export interface H2HFixture {
    fixture: { id: number; date: string };
    league: { name: string; logo: string };
    teams: {
        home: { id: number; name: string; logo: string; winner: boolean | null };
        away: { id: number; name: string; logo: string; winner: boolean | null }
    };
    goals: { home: number | null; away: number | null };
}

export function factorial(n: number): number {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

export function poisson(k: number, lambda: number): number {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function computeLambdas(
    homeMatches: H2HFixture[],
    awayMatches: H2HFixture[],
    homeTeamId: number,
    awayTeamId: number
) {
    // Filter home team's HOME matches and get goals scored
    const homeAsHome = homeMatches.filter(m => m.teams.home.id === homeTeamId);
    const homeGoals = homeAsHome
        .filter(m => m.goals.home !== null)
        .map(m => m.goals.home!);

    // Filter away team's AWAY matches and get goals scored
    const awayAsAway = awayMatches.filter(m => m.teams.away.id === awayTeamId);
    const awayGoals = awayAsAway
        .filter(m => m.goals.away !== null)
        .map(m => m.goals.away!);

    // Try 20, fallback to 15, then 10
    let sampleSize = 20;
    let homeSlice = homeGoals.slice(0, 20);
    let awaySlice = awayGoals.slice(0, 20);

    if (homeSlice.length < 15 || awaySlice.length < 15) {
        sampleSize = Math.min(homeSlice.length, awaySlice.length);
    }

    const effectiveHome = homeSlice.length;
    const effectiveAway = awaySlice.length;
    const effectiveSample = Math.min(effectiveHome, effectiveAway);

    let confidence: 'Alta' | 'Média' | 'Baixa' = 'Baixa';
    if (effectiveSample >= 15) confidence = 'Alta';
    else if (effectiveSample >= 10) confidence = 'Média';

    const lambdaHome = homeSlice.length > 0
        ? homeSlice.reduce((a, b) => a + b, 0) / homeSlice.length
        : 0;
    const lambdaAway = awaySlice.length > 0
        ? awaySlice.reduce((a, b) => a + b, 0) / awaySlice.length
        : 0;
    const lambdaTotal = lambdaHome + lambdaAway;

    return { lambdaHome, lambdaAway, lambdaTotal, confidence, effectiveHome, effectiveAway, effectiveSample };
}

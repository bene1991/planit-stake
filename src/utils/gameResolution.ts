import { MethodOperation } from "@/hooks/useSupabaseGames";

/**
 * Automatically determines the result of a method based on the final score.
 */
export function autoResolveMethod(
    methodName: string,
    homeScore: number,
    awayScore: number
): 'Green' | 'Red' | 'Void' | undefined {
    const name = methodName.toLowerCase();

    // Lay 1x0
    if (name.includes('lay 1x0') || name.includes('lay 1-0')) {
        return (homeScore === 1 && awayScore === 0) ? 'Red' : 'Green';
    }

    // Lay 0x1
    if (name.includes('lay 0x1') || name.includes('lay 0-1')) {
        return (homeScore === 0 && awayScore === 1) ? 'Red' : 'Green';
    }

    // Lay 0x0 / 0-0
    if (name.includes('lay 0x0') || name.includes('lay 0-0')) {
        return (homeScore === 0 && awayScore === 0) ? 'Red' : 'Green';
    }

    // Lay 1x1
    if (name.includes('lay 1x1') || name.includes('lay 1-1')) {
        return (homeScore === 1 && awayScore === 1) ? 'Red' : 'Green';
    }

    // Lay 2x0
    if (name.includes('lay 2x0') || name.includes('lay 2-0')) {
        return (homeScore === 2 && awayScore === 0) ? 'Red' : 'Green';
    }

    // Lay 0x2
    if (name.includes('lay 0x2') || name.includes('lay 0-2')) {
        return (homeScore === 0 && awayScore === 2) ? 'Red' : 'Green';
    }

    // Back (General) - Match Winner
    if (name === 'back' || name === 'back mandante') {
        return (homeScore > awayScore) ? 'Green' : 'Red';
    }
    if (name === 'back visitante') {
        return (awayScore > homeScore) ? 'Green' : 'Red';
    }

    return undefined;
}

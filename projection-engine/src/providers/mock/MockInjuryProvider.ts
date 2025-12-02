/**
 * Mock Injury Provider
 * 
 * Provides mock injury status data for testing and development.
 * Generates realistic injury reports without external API calls.
 */

import {
  InjuryProvider,
  SportCode,
  PlayerInjury,
  InjuryStatusCode,
} from '../interfaces';

/**
 * Mock implementation of InjuryProvider.
 * Generates a mix of injury statuses for testing purposes.
 */
export class MockInjuryProvider implements InjuryProvider {
  
  /**
   * Get mock injury report for the specified date and sport.
   */
  async getInjuryReport(date: string, sport: SportCode): Promise<PlayerInjury[]> {
    // Generate 5-15 injured players across all teams
    const numInjured = 5 + Math.floor(Math.random() * 11);
    const injuries: PlayerInjury[] = [];
    
    const statuses: InjuryStatusCode[] = ['OUT', 'Q', 'D', 'P', 'ACTIVE'];
    const injuryTypes = this.getInjuryTypesForSport(sport);
    const playerNames = this.getPlayerNames();
    
    for (let i = 0; i < numInjured; i++) {
      // Weight toward OUT and Q statuses for more realistic testing
      const statusWeights = [0.25, 0.30, 0.15, 0.20, 0.10]; // OUT, Q, D, P, ACTIVE
      const statusIndex = this.weightedRandom(statusWeights);
      const status = statuses[statusIndex] ?? 'Q';
      
      const injuryType = injuryTypes[Math.floor(Math.random() * injuryTypes.length)] ?? 'General Soreness';
      const playerName = playerNames[i % playerNames.length] ?? `Player ${i}`;
      
      injuries.push({
        playerId: `injured_${sport.toLowerCase()}_${i}`,
        playerName: `${playerName} (Injured ${i + 1})`,
        teamId: `team_${sport.toLowerCase()}_${i % 10}`,
        status,
        injuryType,
        notes: this.generateInjuryNote(status, injuryType),
        lastUpdated: new Date(),
      });
    }
    
    return injuries;
  }
  
  /**
   * Get injury types specific to a sport.
   */
  private getInjuryTypesForSport(sport: SportCode): string[] {
    const injuryTypes: Record<string, string[]> = {
      'NBA': ['Ankle', 'Knee', 'Hamstring', 'Calf', 'Shoulder', 'Back', 'Illness', 'Rest'],
      'WNBA': ['Ankle', 'Knee', 'Hamstring', 'Calf', 'Shoulder', 'Back', 'Illness', 'Rest'],
      'NFL': ['Knee', 'Ankle', 'Hamstring', 'Shoulder', 'Concussion', 'Quad', 'Calf', 'Back'],
      'NCAA_FB': ['Knee', 'Ankle', 'Hamstring', 'Shoulder', 'Concussion', 'Quad', 'Calf'],
      'EPL': ['Hamstring', 'Knee', 'Ankle', 'Groin', 'Thigh', 'Calf', 'Muscle Strain'],
      'LA_LIGA': ['Hamstring', 'Knee', 'Ankle', 'Groin', 'Thigh', 'Calf', 'Muscle Strain'],
      'BUNDESLIGA': ['Hamstring', 'Knee', 'Ankle', 'Groin', 'Thigh', 'Calf', 'Muscle Strain'],
      'SERIE_A': ['Hamstring', 'Knee', 'Ankle', 'Groin', 'Thigh', 'Calf', 'Muscle Strain'],
      'LIGUE_1': ['Hamstring', 'Knee', 'Ankle', 'Groin', 'Thigh', 'Calf', 'Muscle Strain'],
      'MLS': ['Hamstring', 'Knee', 'Ankle', 'Groin', 'Thigh', 'Calf', 'Muscle Strain'],
      'UEFA_CL': ['Hamstring', 'Knee', 'Ankle', 'Groin', 'Thigh', 'Calf', 'Muscle Strain'],
      'LOL': ['Wrist', 'Hand', 'Illness', 'Personal'],
      'CSGO': ['Wrist', 'Hand', 'Illness', 'Personal'],
      'VALORANT': ['Wrist', 'Hand', 'Illness', 'Personal'],
      'DOTA2': ['Wrist', 'Hand', 'Illness', 'Personal'],
    };
    
    return injuryTypes[sport] ?? ['General Soreness', 'Illness', 'Personal'];
  }
  
  /**
   * Generate injury note based on status and type.
   */
  private generateInjuryNote(status: InjuryStatusCode, injuryType: string): string {
    switch (status) {
      case 'OUT':
        return `${injuryType} - Out indefinitely`;
      case 'D':
        return `${injuryType} - Unlikely to play`;
      case 'Q':
        return `${injuryType} - Game time decision`;
      case 'P':
        return `${injuryType} - Expected to play`;
      case 'ACTIVE':
        return `Cleared to play`;
      default:
        return `${injuryType}`;
    }
  }
  
  /**
   * Get common player names for mock data.
   */
  private getPlayerNames(): string[] {
    return [
      'Star', 'Elite', 'Veteran', 'Rising', 'Solid',
      'Key', 'Starter', 'Bench', 'Reserve', 'Prospect',
    ];
  }
  
  /**
   * Weighted random selection.
   */
  private weightedRandom(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i] ?? 0;
      if (random <= 0) return i;
    }
    
    return weights.length - 1;
  }
}

/**
 * Base Data Provider
 * 
 * Abstract class that defines the interface for all sport-specific data providers.
 * Each sport implementation should extend this class and implement the required methods.
 */

import {
  Sport,
  League,
  Schedule,
  Player,
  PlayerStats,
  DataProvider,
  Game,
  Team,
  TeamProjection,
} from '../types';

export abstract class BaseDataProvider implements DataProvider {
  abstract sport: Sport;
  abstract supportedLeagues: League[];
  
  protected apiKey?: string;
  protected baseUrl: string = '';
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }
  
  abstract getSchedule(league: League, date: string): Promise<Schedule>;
  abstract getTeamRoster(teamId: string): Promise<Player[]>;
  abstract getPlayerStats(playerId: string, numGames?: number): Promise<PlayerStats[]>;
  abstract getTeamStats(teamId: string, numGames?: number): Promise<Record<string, number>>;
  abstract getInjuryReport(league: League): Promise<Player[]>;
  abstract getGameBoxScore(gameId: string): Promise<{
    home: { team: TeamProjection; players: PlayerStats[] };
    away: { team: TeamProjection; players: PlayerStats[] };
  } | null>;
  
  /**
   * Validate that the provider supports the given league
   */
  protected validateLeague(league: League): void {
    if (!this.supportedLeagues.includes(league)) {
      throw new Error(`League ${league} not supported by ${this.sport} provider`);
    }
  }
  
  /**
   * Helper to format date string to YYYY-MM-DD
   */
  protected formatDate(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString().split('T')[0] as string;
    }
    // Already formatted
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return new Date(date).toISOString().split('T')[0] as string;
  }
  
  /**
   * Calculate confidence penalty based on injury status
   */
  protected getInjuryConfidencePenalty(status: string): number {
    const penalties: Record<string, number> = {
      'healthy': 1.0,
      'probable': 0.95,
      'day-to-day': 0.8,
      'questionable': 0.6,
      'doubtful': 0.3,
      'out': 0,
    };
    return penalties[status] ?? 1.0;
  }
}

/**
 * Mock Data Provider for Testing
 * 
 * Provides realistic mock data for testing the projection engine
 * without requiring actual API calls.
 */
export class MockDataProvider extends BaseDataProvider {
  sport: Sport;
  supportedLeagues: League[];
  
  constructor(sport: Sport, leagues: League[]) {
    super();
    this.sport = sport;
    this.supportedLeagues = leagues;
  }
  
  async getSchedule(league: League, date: string): Promise<Schedule> {
    this.validateLeague(league);
    
    // Generate mock games based on sport
    const games = this.generateMockGames(league, date);
    
    return {
      date: this.formatDate(date),
      sport: this.sport,
      league,
      games,
    };
  }
  
  async getTeamRoster(teamId: string): Promise<Player[]> {
    // Generate mock roster with 12-15 players
    const numPlayers = 12 + Math.floor(Math.random() * 4);
    const players: Player[] = [];
    
    for (let i = 0; i < numPlayers; i++) {
      players.push({
        id: `player_${teamId}_${i}`,
        name: `Player ${i + 1}`,
        teamId,
        position: this.getRandomPosition(),
        status: 'active',
        injuryStatus: Math.random() > 0.8 ? 'questionable' : 'healthy',
      });
    }
    
    return players;
  }
  
  async getPlayerStats(playerId: string, numGames: number = 10): Promise<PlayerStats[]> {
    // Generate mock historical stats
    const stats: PlayerStats[] = [];
    const today = new Date();
    
    for (let i = 0; i < numGames; i++) {
      const gameDate = new Date(today);
      gameDate.setDate(gameDate.getDate() - (i + 1) * 2); // Every other day
      
      stats.push(this.generateMockPlayerStats(playerId, gameDate));
    }
    
    return stats;
  }
  
  async getTeamStats(teamId: string, numGames: number = 10): Promise<Record<string, number>> {
    // Generate mock team stats (averages)
    return this.generateMockTeamStats(teamId);
  }
  
  async getInjuryReport(league: League): Promise<Player[]> {
    this.validateLeague(league);
    
    // Return a few mock injured players
    return [
      {
        id: 'injured_1',
        name: 'Star Player',
        teamId: 'team_1',
        position: 'PG',
        status: 'active',
        injuryStatus: 'questionable',
        injuryNote: 'Ankle - Game Time Decision',
      },
      {
        id: 'injured_2',
        name: 'Bench Player',
        teamId: 'team_2',
        position: 'C',
        status: 'active',
        injuryStatus: 'out',
        injuryNote: 'Knee - Out 2-3 weeks',
      },
    ];
  }
  
  async getGameBoxScore(gameId: string): Promise<{
    home: { team: TeamProjection; players: PlayerStats[] };
    away: { team: TeamProjection; players: PlayerStats[] };
  } | null> {
    // Return null for games not yet completed
    return null;
  }
  
  private generateMockGames(league: League, date: string): Game[] {
    const numGames = 3 + Math.floor(Math.random() * 5);
    const games: Game[] = [];
    
    for (let i = 0; i < numGames; i++) {
      const homeTeam: Team = {
        id: `team_home_${i}`,
        name: `Home Team ${i + 1}`,
        abbreviation: `HT${i + 1}`,
        league,
        sport: this.sport,
      };
      
      const awayTeam: Team = {
        id: `team_away_${i}`,
        name: `Away Team ${i + 1}`,
        abbreviation: `AT${i + 1}`,
        league,
        sport: this.sport,
      };
      
      const gameDate = new Date(date);
      gameDate.setHours(19 + i); // Games start at 7pm, 8pm, etc.
      
      games.push({
        id: `game_${date}_${i}`,
        sport: this.sport,
        league,
        homeTeam,
        awayTeam,
        startTime: gameDate,
        venue: `Arena ${i + 1}`,
        status: 'scheduled',
      });
    }
    
    return games;
  }
  
  private getRandomPosition(): string {
    const positions: Record<Sport, string[]> = {
      basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
      football: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'],
      soccer: ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      esports: ['TOP', 'JNG', 'MID', 'ADC', 'SUP'],
    };
    
    const sportPositions = positions[this.sport] ?? ['Player'];
    return sportPositions[Math.floor(Math.random() * sportPositions.length)] as string;
  }
  
  private generateMockPlayerStats(playerId: string, gameDate: Date): PlayerStats {
    const baseStats = {
      playerId,
      gameId: `game_${gameDate.toISOString().split('T')[0]}`,
      date: gameDate.toISOString().split('T')[0] as string,
      minutesPlayed: 20 + Math.floor(Math.random() * 20),
    };
    
    switch (this.sport) {
      case 'basketball':
        return {
          ...baseStats,
          points: 10 + Math.floor(Math.random() * 25),
          rebounds: 2 + Math.floor(Math.random() * 10),
          assists: 1 + Math.floor(Math.random() * 8),
          steals: Math.floor(Math.random() * 3),
          blocks: Math.floor(Math.random() * 3),
          turnovers: Math.floor(Math.random() * 4),
          threePointersMade: Math.floor(Math.random() * 6),
          threePointersAttempted: 2 + Math.floor(Math.random() * 8),
          fieldGoalsMade: 4 + Math.floor(Math.random() * 10),
          fieldGoalsAttempted: 8 + Math.floor(Math.random() * 15),
          freeThrowsMade: Math.floor(Math.random() * 8),
          freeThrowsAttempted: Math.floor(Math.random() * 10),
        };
      
      case 'football':
        return {
          ...baseStats,
          passingYards: Math.floor(Math.random() * 350),
          passingTouchdowns: Math.floor(Math.random() * 4),
          interceptions: Math.floor(Math.random() * 2),
          rushingYards: Math.floor(Math.random() * 100),
          rushingTouchdowns: Math.floor(Math.random() * 2),
          receivingYards: Math.floor(Math.random() * 120),
          receivingTouchdowns: Math.floor(Math.random() * 2),
          receptions: Math.floor(Math.random() * 10),
        };
      
      case 'soccer':
        return {
          ...baseStats,
          goals: Math.floor(Math.random() * 2),
          assists: Math.floor(Math.random() * 2),
          shots: Math.floor(Math.random() * 5),
          shotsOnTarget: Math.floor(Math.random() * 3),
          keyPasses: Math.floor(Math.random() * 4),
          tackles: Math.floor(Math.random() * 5),
          interceptions: Math.floor(Math.random() * 3),
          clearances: Math.floor(Math.random() * 4),
          yellowCards: Math.random() > 0.85 ? 1 : 0,
          redCards: Math.random() > 0.98 ? 1 : 0,
        };
      
      case 'esports':
        return {
          ...baseStats,
          kills: Math.floor(Math.random() * 15),
          deaths: Math.floor(Math.random() * 8),
          assists: Math.floor(Math.random() * 12),
          cs: 150 + Math.floor(Math.random() * 150),
          gold: 8000 + Math.floor(Math.random() * 8000),
          damageDealt: 10000 + Math.floor(Math.random() * 20000),
        };
      
      default:
        return baseStats as PlayerStats;
    }
  }
  
  private generateMockTeamStats(teamId: string): Record<string, number> {
    switch (this.sport) {
      case 'basketball':
        return {
          pointsPerGame: 105 + Math.random() * 20,
          reboundsPerGame: 40 + Math.random() * 10,
          assistsPerGame: 22 + Math.random() * 8,
          pace: 95 + Math.random() * 10,
          offensiveRating: 105 + Math.random() * 15,
          defensiveRating: 105 + Math.random() * 15,
        };
      
      case 'football':
        return {
          pointsPerGame: 20 + Math.random() * 15,
          yardsPerGame: 300 + Math.random() * 150,
          passingYardsPerGame: 200 + Math.random() * 100,
          rushingYardsPerGame: 80 + Math.random() * 70,
          turnoversPerGame: Math.random() * 2,
        };
      
      case 'soccer':
        return {
          goalsPerGame: 1 + Math.random() * 1.5,
          shotsPerGame: 10 + Math.random() * 8,
          possessionPercent: 40 + Math.random() * 20,
          passAccuracy: 75 + Math.random() * 15,
        };
      
      case 'esports':
        return {
          killsPerGame: 12 + Math.random() * 8,
          deathsPerGame: 8 + Math.random() * 8,
          goldPerMinute: 350 + Math.random() * 100,
          averageGameLength: 25 + Math.random() * 15,
        };
      
      default:
        return {};
    }
  }
}

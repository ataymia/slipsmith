/**
 * Mock Stats Provider
 * 
 * Provides mock player and team statistics for testing and development.
 * Generates realistic stats without external API calls.
 */

import {
  StatsProvider,
  SportCode,
  PlayerRecentStatsMap,
  TeamStatsMap,
  PlayerRecentStats,
  TeamStats,
} from '../interfaces';

/**
 * Mock implementation of StatsProvider.
 * Generates realistic statistics based on sport-specific ranges.
 */
export class MockStatsProvider implements StatsProvider {
  
  /**
   * Get mock recent stats for the specified players.
   */
  async getRecentPlayerStats(
    playerIds: string[],
    sport: SportCode,
    lookbackGames: number = 10
  ): Promise<PlayerRecentStatsMap> {
    const statsMap: PlayerRecentStatsMap = new Map();
    
    for (const playerId of playerIds) {
      const stats = this.generatePlayerStats(playerId, sport, lookbackGames);
      statsMap.set(playerId, stats);
    }
    
    return statsMap;
  }
  
  /**
   * Get mock historical stats for the specified teams.
   */
  async getHistoricalTeamStats(teamIds: string[], sport: SportCode): Promise<TeamStatsMap> {
    const statsMap: TeamStatsMap = new Map();
    
    for (const teamId of teamIds) {
      const stats = this.generateTeamStats(teamId, sport);
      statsMap.set(teamId, stats);
    }
    
    return statsMap;
  }
  
  /**
   * Generate mock player statistics.
   */
  private generatePlayerStats(
    playerId: string,
    sport: SportCode,
    gamesPlayed: number
  ): PlayerRecentStats {
    const stats = this.getBaseStatsForSport(sport);
    
    return {
      playerId,
      playerName: `Player ${playerId}`,
      teamId: `team_${playerId.split('_')[1] ?? 'unknown'}`,
      gamesPlayed,
      stats,
      lastGameDate: new Date().toISOString().split('T')[0],
    };
  }
  
  /**
   * Generate mock team statistics.
   */
  private generateTeamStats(teamId: string, sport: SportCode): TeamStats {
    const stats = this.getBaseTeamStatsForSport(sport);
    
    return {
      teamId,
      teamName: `Team ${teamId}`,
      gamesPlayed: 20 + Math.floor(Math.random() * 40),
      stats,
    };
  }
  
  /**
   * Get base player stats for a sport with randomization.
   */
  private getBaseStatsForSport(sport: SportCode): Record<string, number> {
    switch (sport) {
      case 'NBA':
      case 'WNBA':
        return {
          points: 8 + Math.random() * 25,
          rebounds: 2 + Math.random() * 10,
          assists: 1 + Math.random() * 8,
          steals: Math.random() * 2,
          blocks: Math.random() * 2,
          turnovers: 0.5 + Math.random() * 3,
          threePointersMade: Math.random() * 4,
          fieldGoalPercentage: 0.38 + Math.random() * 0.2,
          freeThrowPercentage: 0.65 + Math.random() * 0.25,
          minutesPerGame: 15 + Math.random() * 25,
        };
      
      case 'NFL':
      case 'NCAA_FB':
        return {
          passingYards: Math.random() * 350,
          passingTouchdowns: Math.random() * 4,
          interceptions: Math.random() * 2,
          rushingYards: Math.random() * 100,
          rushingTouchdowns: Math.random() * 2,
          receivingYards: Math.random() * 120,
          receivingTouchdowns: Math.random() * 2,
          receptions: Math.random() * 8,
          targets: Math.random() * 12,
        };
      
      case 'EPL':
      case 'LA_LIGA':
      case 'BUNDESLIGA':
      case 'SERIE_A':
      case 'LIGUE_1':
      case 'MLS':
      case 'UEFA_CL':
        return {
          goals: Math.random() * 0.5,
          assists: Math.random() * 0.4,
          shots: 0.5 + Math.random() * 3,
          shotsOnTarget: Math.random() * 1.5,
          keyPasses: Math.random() * 2,
          tackles: Math.random() * 3,
          interceptions: Math.random() * 2,
          minutesPlayed: 60 + Math.random() * 30,
        };
      
      case 'LOL':
      case 'DOTA2':
        return {
          kills: 2 + Math.random() * 8,
          deaths: 1 + Math.random() * 5,
          assists: 3 + Math.random() * 10,
          cs: 150 + Math.random() * 200,
          goldPerMinute: 300 + Math.random() * 200,
          damagePerMinute: 400 + Math.random() * 400,
        };
      
      case 'CSGO':
      case 'VALORANT':
        return {
          kills: 10 + Math.random() * 15,
          deaths: 8 + Math.random() * 10,
          assists: 2 + Math.random() * 6,
          adr: 60 + Math.random() * 40, // Average damage per round
          kast: 0.5 + Math.random() * 0.4, // Kill/Assist/Survived/Traded %
        };
      
      default:
        return {
          score: Math.random() * 20,
          assists: Math.random() * 10,
        };
    }
  }
  
  /**
   * Get base team stats for a sport with randomization.
   */
  private getBaseTeamStatsForSport(sport: SportCode): Record<string, number> {
    switch (sport) {
      case 'NBA':
      case 'WNBA':
        return {
          pointsPerGame: 100 + Math.random() * 25,
          reboundsPerGame: 40 + Math.random() * 10,
          assistsPerGame: 20 + Math.random() * 10,
          pace: 95 + Math.random() * 15,
          offensiveRating: 105 + Math.random() * 15,
          defensiveRating: 105 + Math.random() * 15,
        };
      
      case 'NFL':
      case 'NCAA_FB':
        return {
          pointsPerGame: 17 + Math.random() * 15,
          yardsPerGame: 300 + Math.random() * 150,
          passingYardsPerGame: 180 + Math.random() * 100,
          rushingYardsPerGame: 80 + Math.random() * 80,
          turnoversPerGame: 0.5 + Math.random() * 2,
        };
      
      case 'EPL':
      case 'LA_LIGA':
      case 'BUNDESLIGA':
      case 'SERIE_A':
      case 'LIGUE_1':
      case 'MLS':
      case 'UEFA_CL':
        return {
          goalsPerGame: 0.8 + Math.random() * 2,
          shotsPerGame: 8 + Math.random() * 10,
          possessionPercentage: 40 + Math.random() * 20,
          passAccuracy: 75 + Math.random() * 15,
        };
      
      case 'LOL':
      case 'DOTA2':
        return {
          killsPerGame: 10 + Math.random() * 15,
          deathsPerGame: 5 + Math.random() * 15,
          goldDifferenceAt15: -3000 + Math.random() * 6000,
          averageGameLength: 25 + Math.random() * 15,
          winRate: 0.3 + Math.random() * 0.4,
        };
      
      case 'CSGO':
      case 'VALORANT':
        return {
          roundsPerMap: 20 + Math.random() * 10,
          winRate: 0.4 + Math.random() * 0.2,
          clutchSuccessRate: 0.2 + Math.random() * 0.3,
        };
      
      default:
        return {
          winsPerSeason: Math.random() * 50,
          scorePerGame: Math.random() * 100,
        };
    }
  }
}

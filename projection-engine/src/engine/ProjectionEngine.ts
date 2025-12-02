/**
 * Projection Engine
 * 
 * The core projection engine that generates team and player projections
 * based on historical data, matchup analysis, and various adjustments.
 * 
 * This is the "brain" of the SlipSmith system.
 */

import {
  Sport,
  League,
  Game,
  Player,
  PlayerStats,
  BasketballPlayerStats,
  FootballPlayerStats,
  SoccerPlayerStats,
  EsportsPlayerStats,
  TeamProjection,
  PlayerProjection,
  GameProjection,
  ProjectionAdjustment,
  Schedule,
} from '../types';
import { ProviderFactory } from '../providers';

/**
 * Projection Engine Configuration
 */
export interface ProjectionConfig {
  // Number of historical games to consider
  historicalGamesCount: number;
  
  // Weight for recent games (higher = more emphasis on recent performance)
  recencyWeight: number;
  
  // Home/Away adjustment factor
  homeAdvantage: number;
  
  // Injury status weights
  injuryPenalties: Record<string, number>;
  
  // Confidence thresholds
  minConfidence: number;
}

const DEFAULT_CONFIG: ProjectionConfig = {
  historicalGamesCount: 10,
  recencyWeight: 1.5,
  homeAdvantage: 0.03, // 3% advantage for home team
  injuryPenalties: {
    'healthy': 1.0,
    'probable': 0.98,
    'day-to-day': 0.85,
    'questionable': 0.65,
    'doubtful': 0.30,
    'out': 0,
  },
  minConfidence: 0.5,
};

export class ProjectionEngine {
  private providerFactory: ProviderFactory;
  private config: ProjectionConfig;
  
  constructor(providerFactory: ProviderFactory, config: Partial<ProjectionConfig> = {}) {
    this.providerFactory = providerFactory;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Generate projections for all games on a given date
   */
  async generateProjections(league: League, date: string): Promise<GameProjection[]> {
    const provider = this.providerFactory.getProviderForLeague(league);
    
    // Step 1: Get schedule for the date
    const schedule = await provider.getSchedule(league, date);
    
    if (schedule.games.length === 0) {
      return [];
    }
    
    // Step 2: Get injury report
    const injuries = await provider.getInjuryReport(league);
    const injuryMap = new Map(injuries.map(p => [p.id, p]));
    
    // Step 3: Generate projections for each game
    const projections: GameProjection[] = [];
    
    for (const game of schedule.games) {
      try {
        const gameProjection = await this.projectGame(
          game,
          provider,
          injuryMap
        );
        projections.push(gameProjection);
      } catch (error) {
        console.error(`Error projecting game ${game.id}:`, error);
      }
    }
    
    return projections;
  }
  
  /**
   * Project a single game
   */
  private async projectGame(
    game: Game,
    provider: any,
    injuryMap: Map<string, Player>
  ): Promise<GameProjection> {
    const sport = game.sport;
    
    // Get rosters for both teams
    const [homeRoster, awayRoster] = await Promise.all([
      provider.getTeamRoster(game.homeTeam.id),
      provider.getTeamRoster(game.awayTeam.id),
    ]);
    
    // Get team stats
    const [homeTeamStats, awayTeamStats] = await Promise.all([
      provider.getTeamStats(game.homeTeam.id),
      provider.getTeamStats(game.awayTeam.id),
    ]);
    
    // Project team totals
    const homeTeamProjection = this.projectTeam(
      game.homeTeam,
      game,
      homeTeamStats,
      true,
      sport
    );
    
    const awayTeamProjection = this.projectTeam(
      game.awayTeam,
      game,
      awayTeamStats,
      false,
      sport
    );
    
    // Project individual players
    const playerProjections: PlayerProjection[] = [];
    
    // Project home team players
    for (const player of homeRoster) {
      const injury = injuryMap.get(player.id);
      const injuryStatus = injury?.injuryStatus ?? player.injuryStatus ?? 'healthy';
      
      // Skip players who are out
      if (injuryStatus === 'out') continue;
      
      try {
        const stats = await provider.getPlayerStats(player.id, this.config.historicalGamesCount);
        const projection = this.projectPlayer(
          player,
          game,
          stats,
          injuryStatus,
          homeTeamProjection,
          sport
        );
        playerProjections.push(projection);
      } catch (error) {
        // Skip players with no stats
      }
    }
    
    // Project away team players
    for (const player of awayRoster) {
      const injury = injuryMap.get(player.id);
      const injuryStatus = injury?.injuryStatus ?? player.injuryStatus ?? 'healthy';
      
      if (injuryStatus === 'out') continue;
      
      try {
        const stats = await provider.getPlayerStats(player.id, this.config.historicalGamesCount);
        const projection = this.projectPlayer(
          player,
          game,
          stats,
          injuryStatus,
          awayTeamProjection,
          sport
        );
        playerProjections.push(projection);
      } catch (error) {
        // Skip players with no stats
      }
    }
    
    return {
      gameId: game.id,
      sport: game.sport,
      league: game.league,
      date: game.startTime.toISOString().split('T')[0] as string,
      homeTeam: homeTeamProjection,
      awayTeam: awayTeamProjection,
      players: playerProjections,
      generatedAt: new Date(),
    };
  }
  
  /**
   * Project team totals
   */
  private projectTeam(
    team: { id: string; name: string },
    game: Game,
    teamStats: Record<string, number>,
    isHome: boolean,
    sport: Sport
  ): TeamProjection {
    const adjustments: ProjectionAdjustment[] = [];
    let projectedScore = 0;
    
    // Calculate base score from historical averages
    switch (sport) {
      case 'basketball':
        projectedScore = teamStats.pointsPerGame ?? 110;
        break;
      case 'football':
        projectedScore = teamStats.pointsPerGame ?? 22;
        break;
      case 'soccer':
        projectedScore = teamStats.goalsPerGame ?? 1.5;
        break;
      case 'esports':
        projectedScore = teamStats.killsPerGame ?? 15;
        break;
    }
    
    // Apply home advantage
    let homeFactor = 1.0;
    if (isHome) {
      homeFactor = 1 + this.config.homeAdvantage;
      adjustments.push({
        type: 'home_away',
        factor: homeFactor,
        description: 'Home court/field advantage',
      });
    } else {
      homeFactor = 1 - this.config.homeAdvantage;
      adjustments.push({
        type: 'home_away',
        factor: homeFactor,
        description: 'Away game penalty',
      });
    }
    
    projectedScore *= homeFactor;
    
    return {
      teamId: team.id,
      teamName: team.name,
      gameId: game.id,
      sport,
      league: game.league,
      projectedScore: Math.round(projectedScore * 10) / 10,
      projectedStats: {
        ...teamStats,
        projectedScore,
      },
      confidence: 0.75,
    };
  }
  
  /**
   * Project individual player
   */
  private projectPlayer(
    player: Player,
    game: Game,
    historicalStats: PlayerStats[],
    injuryStatus: string,
    teamProjection: TeamProjection,
    sport: Sport
  ): PlayerProjection {
    const adjustments: ProjectionAdjustment[] = [];
    let confidence = 0.8;
    
    // Calculate weighted averages from historical stats
    const projectedStats = this.calculateWeightedStats(historicalStats, sport);
    
    // Apply injury penalty
    const injuryPenalty = this.config.injuryPenalties[injuryStatus];
    if (injuryPenalty === undefined) {
      console.warn(`Unknown injury status "${injuryStatus}" for player ${player.name}, using default (1.0)`);
    }
    const appliedPenalty = injuryPenalty ?? 1.0;
    if (appliedPenalty < 1.0) {
      adjustments.push({
        type: 'injury',
        factor: appliedPenalty,
        description: `Injury status: ${injuryStatus}`,
      });
      confidence *= appliedPenalty;
      
      // Apply penalty to all stats
      for (const key of Object.keys(projectedStats)) {
        projectedStats[key] = (projectedStats[key] ?? 0) * injuryPenalty;
      }
    }
    
    // Apply home/away adjustment
    const isHome = player.teamId === game.homeTeam.id;
    const homeAdjust = isHome ? 1.02 : 0.98;
    adjustments.push({
      type: 'home_away',
      factor: homeAdjust,
      description: isHome ? 'Home advantage' : 'Away adjustment',
    });
    
    // Apply to key stats
    for (const key of Object.keys(projectedStats)) {
      projectedStats[key] = Math.round(((projectedStats[key] ?? 0) * homeAdjust) * 10) / 10;
    }
    
    return {
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId,
      gameId: game.id,
      sport,
      league: game.league,
      position: player.position,
      projectedStats,
      confidence: Math.max(this.config.minConfidence, confidence),
      adjustments,
    };
  }
  
  /**
   * Calculate weighted averages from historical stats
   */
  private calculateWeightedStats(
    stats: PlayerStats[],
    sport: Sport
  ): Record<string, number> {
    if (stats.length === 0) {
      return this.getDefaultStats(sport);
    }
    
    const result: Record<string, number> = {};
    let totalWeight = 0;
    
    // Calculate weighted averages with recency weighting
    stats.forEach((stat, index) => {
      // More recent games have higher weight
      const weight = Math.pow(this.config.recencyWeight, stats.length - index - 1);
      totalWeight += weight;
      
      // Get stat keys based on sport
      const statKeys = this.getStatKeys(sport);
      
      for (const key of statKeys) {
        const value = (stat as unknown as Record<string, unknown>)[key] as number | undefined;
        if (typeof value === 'number') {
          result[key] = (result[key] ?? 0) + value * weight;
        }
      }
    });
    
    // Normalize by total weight
    for (const key of Object.keys(result)) {
      result[key] = Math.round(((result[key] ?? 0) / totalWeight) * 10) / 10;
    }
    
    return result;
  }
  
  /**
   * Get stat keys for a sport
   */
  private getStatKeys(sport: Sport): string[] {
    switch (sport) {
      case 'basketball':
        return [
          'points', 'rebounds', 'assists', 'steals', 'blocks',
          'turnovers', 'threePointersMade', 'fieldGoalsMade',
          'freeThrowsMade', 'minutesPlayed',
        ];
      case 'football':
        return [
          'passingYards', 'passingTouchdowns', 'interceptions',
          'rushingYards', 'rushingTouchdowns', 'receivingYards',
          'receivingTouchdowns', 'receptions', 'targets',
        ];
      case 'soccer':
        return [
          'goals', 'assists', 'shots', 'shotsOnTarget',
          'keyPasses', 'tackles', 'interceptions',
        ];
      case 'esports':
        return [
          'kills', 'deaths', 'assists', 'cs', 'gold',
          'damageDealt', 'visionScore',
        ];
      default:
        return [];
    }
  }
  
  /**
   * Get default stats for new or no-data players
   */
  private getDefaultStats(sport: Sport): Record<string, number> {
    switch (sport) {
      case 'basketball':
        return {
          points: 8,
          rebounds: 3,
          assists: 2,
          steals: 0.5,
          blocks: 0.3,
          turnovers: 1,
          threePointersMade: 0.5,
          minutesPlayed: 15,
        };
      case 'football':
        return {
          passingYards: 0,
          rushingYards: 20,
          receivingYards: 30,
          receptions: 2,
        };
      case 'soccer':
        return {
          goals: 0.1,
          assists: 0.1,
          shots: 1,
          shotsOnTarget: 0.3,
        };
      case 'esports':
        return {
          kills: 3,
          deaths: 3,
          assists: 4,
          cs: 180,
        };
      default:
        return {};
    }
  }
}

export default ProjectionEngine;

/**
 * SlipSmith Slip Service
 * 
 * High-level service for generating SlipSmith slips in the official export format.
 * This is the primary interface for programmatic access to top events.
 */

import {
  Sport,
  League,
  SlipSmithSlip,
  SlipTier,
  ConsensusLine,
  MarketType,
  Event,
} from '../types';
import { ProviderFactory, ProviderConfig } from '../providers';
import { ProjectionEngine } from './ProjectionEngine';
import { EdgeDetector } from './EdgeDetector';
import { EvaluationEngine } from '../evaluation';
import { buildSlipSmithSlip } from '../utils/slipBuilder';

/**
 * Options for getTopEvents function
 */
export interface GetTopEventsOptions {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Sport/League identifier (e.g., "NBA", "NFL") */
  sport: string;
  /** Tier level: "starter", "pro", or "vip" */
  tier?: SlipTier;
  /** Maximum number of events to return (default: 20) */
  limit?: number;
  /** Minimum probability filter 0-1 (default: 0.5) */
  minProbability?: number;
}

/**
 * SlipService configuration
 */
export interface SlipServiceConfig {
  /** Path to SQLite database for evaluation history */
  dbPath?: string;
  /** Provider configuration */
  providerConfig?: ProviderConfig;
}

const DEFAULT_CONFIG: SlipServiceConfig = {
  dbPath: './data/slipsmith.db',
  providerConfig: {
    useMockData: false,
  },
};

/**
 * SlipService - Main interface for generating SlipSmith slips
 */
export class SlipService {
  private providerFactory: ProviderFactory;
  private projectionEngine: ProjectionEngine;
  private edgeDetector: EdgeDetector;
  private evaluationEngine: EvaluationEngine;
  private config: SlipServiceConfig;

  constructor(config: SlipServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.providerFactory = new ProviderFactory(this.config.providerConfig ?? {});
    this.projectionEngine = new ProjectionEngine(this.providerFactory);
    this.edgeDetector = new EdgeDetector();
    this.evaluationEngine = new EvaluationEngine(
      this.config.dbPath ?? './data/slipsmith.db',
      this.providerFactory
    );
  }

  /**
   * Get top events in SlipSmith export format
   * 
   * This is the primary method for generating a SlipSmith slip.
   * Returns events in the official JSON schema that all consumers can rely on.
   * 
   * @example
   * ```typescript
   * const slipService = new SlipService({ providerConfig: { useMockData: true } });
   * const slip = await slipService.getTopEvents({
   *   date: '2025-12-01',
   *   sport: 'NBA',
   *   tier: 'vip',
   *   limit: 10,
   * });
   * console.log(JSON.stringify(slip, null, 2));
   * ```
   */
  async getTopEvents(options: GetTopEventsOptions): Promise<SlipSmithSlip> {
    const {
      date,
      sport: sportQuery,
      tier = 'starter',
      limit = 20,
      minProbability = 0.5,
    } = options;

    // Validate date format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.');
    }

    // Map sport query to league
    const league = sportQuery.toUpperCase() as League;
    
    // Get sport for this league
    let sport: Sport;
    try {
      sport = this.providerFactory.getSportForLeague(league);
    } catch {
      throw new Error(`Unknown sport/league: ${sportQuery}`);
    }

    // Generate projections
    const projections = await this.projectionEngine.generateProjections(league, date);

    // Get consensus lines
    const lines = this.generateMockLines(projections, league);

    // Get reliability scores
    const reliabilityScores = this.evaluationEngine.getReliabilityScores(sport, league);

    // Find edges
    let events = this.edgeDetector.findEdges(projections, lines, reliabilityScores);

    // Filter by probability
    events = this.edgeDetector.filterByProbability(events, minProbability);

    // Get top events
    events = this.edgeDetector.getTopEvents(events, limit);

    // Store for later evaluation
    this.evaluationEngine.storeEvents(events);

    // Build warning if using mock data
    let warning: string | undefined;
    if (this.config.providerConfig?.useMockData) {
      warning = 'Using mock data for demonstration. Connect real API providers for production use.';
    }

    // Build and return SlipSmith Slip
    return buildSlipSmithSlip(events, date, sport, league, tier, warning);
  }

  /**
   * Get supported sports and leagues
   */
  getSupportedSports(): Record<Sport, League[]> {
    const sports = this.providerFactory.getSupportedSports();
    const result: Record<Sport, League[]> = {} as any;

    for (const sport of sports) {
      result[sport] = this.providerFactory.getSupportedLeagues(sport);
    }

    return result;
  }

  /**
   * Close database connections
   */
  close(): void {
    this.evaluationEngine.close();
  }

  /**
   * Generate mock consensus lines for testing
   * In production, these would come from a lines provider
   */
  private generateMockLines(projections: any[], league: League): ConsensusLine[] {
    const lines: ConsensusLine[] = [];

    for (const game of projections) {
      // Generate player lines
      for (const player of game.players) {
        for (const [stat, value] of Object.entries(player.projectedStats)) {
          if (typeof value !== 'number') continue;

          const market = this.statToMarket(stat);
          if (!market) continue;

          // Create line with slight offset from projection
          const offset = (Math.random() - 0.5) * this.getMarketVariance(market);
          const line = Math.round((value + offset) * 2) / 2;

          lines.push({
            id: `${game.gameId}_${player.playerId}_${market}`,
            gameId: game.gameId,
            sport: game.sport,
            league: game.league,
            playerId: player.playerId,
            playerName: player.playerName,
            teamId: player.teamId,
            market: market as MarketType,
            line,
            timestamp: new Date(),
          });
        }
      }

      // Generate team lines
      for (const teamProjection of [game.homeTeam, game.awayTeam]) {
        lines.push({
          id: `${game.gameId}_${teamProjection.teamId}_TEAM_TOTAL`,
          gameId: game.gameId,
          sport: game.sport,
          league: game.league,
          teamId: teamProjection.teamId,
          teamName: teamProjection.teamName,
          market: 'TEAM_TOTAL',
          line: Math.round(teamProjection.projectedScore + (Math.random() - 0.5) * 6),
          timestamp: new Date(),
        });
      }
    }

    return lines;
  }

  private statToMarket(stat: string): string | null {
    const mapping: Record<string, string> = {
      'points': 'POINTS',
      'rebounds': 'REBOUNDS',
      'assists': 'ASSISTS',
      'threePointersMade': 'THREES',
      'passingYards': 'PASSING_YARDS',
      'rushingYards': 'RUSHING_YARDS',
      'receivingYards': 'RECEIVING_YARDS',
      'receptions': 'RECEPTIONS',
      'goals': 'GOALS',
      'kills': 'KILLS',
    };
    return mapping[stat] ?? null;
  }

  private getMarketVariance(market: string): number {
    const variances: Record<string, number> = {
      'POINTS': 4,
      'REBOUNDS': 2,
      'ASSISTS': 2,
      'THREES': 1,
      'PASSING_YARDS': 30,
      'RUSHING_YARDS': 20,
      'RECEIVING_YARDS': 20,
      'RECEPTIONS': 2,
      'GOALS': 0.5,
      'KILLS': 2,
    };
    return variances[market] ?? 1;
  }
}

/**
 * Factory function for quick access to getTopEvents
 * 
 * @example
 * ```typescript
 * import { getTopEvents } from './engine/SlipService';
 * 
 * const slip = await getTopEvents({
 *   date: '2025-12-01',
 *   sport: 'NBA',
 *   tier: 'vip',
 * });
 * ```
 */
export async function getTopEvents(options: GetTopEventsOptions): Promise<SlipSmithSlip> {
  const service = new SlipService({
    providerConfig: {
      useMockData: process.env.USE_MOCK_DATA === 'true',
    },
  });
  
  try {
    return await service.getTopEvents(options);
  } finally {
    service.close();
  }
}

export default SlipService;

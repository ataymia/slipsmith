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

// =============================================================================
// SLIPSMITH PROBABILITY THRESHOLDS (Risk Gating)
// =============================================================================
// 🟢 GREEN: probability > 0.77 (high confidence picks)
// 🟡 YELLOW: 0.60 <= probability <= 0.77 (moderate confidence picks)
// 🔴 RED: probability < 0.60 (must NOT be included in slips)
// =============================================================================

/** Minimum probability threshold for SlipSmith slips (no red picks allowed) */
export const SLIPSMITH_MIN_PROBABILITY = 0.60;

/** Threshold above which events are considered "green" (high confidence) */
export const GREEN_PROBABILITY_THRESHOLD = 0.77;

/**
 * Get the required minimum pick count by league.
 * These minimums ensure meaningful slip coverage for each sport.
 * 
 * @param league - The league identifier
 * @returns Minimum number of events to include if available
 */
export function getRequiredMinByLeague(league: League): number {
  const minimums: Partial<Record<League, number>> = {
    'NBA': 30,
    'WNBA': 20,
    'NFL': 15,
    // NCAA_FB not specified, uses default
  };
  return minimums[league] ?? 20; // Default minimum for other leagues
}

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
  /** Minimum probability filter 0-1 (default: 0.60, clamped to at least 0.60) */
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
   * SlipSmith Rules Applied:
   * - Only events with probability >= 0.60 are included (no red picks)
   * - Green events (> 0.77) are prioritized, then yellow events (0.60-0.77)
   * - Sport-specific minimum pick counts are enforced (NBA: 30, NFL: 15, etc.)
   * - Events are sorted by probability (highest to lowest)
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
      minProbability: callerMinProbability = SLIPSMITH_MIN_PROBABILITY,
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

    // =======================================================================
    // SLIPSMITH MINIMUM PROBABILITY ENFORCEMENT
    // Clamp minProbability to at least 0.60 to prevent any red picks
    // =======================================================================
    const effectiveMinProbability = Math.max(callerMinProbability, SLIPSMITH_MIN_PROBABILITY);

    // =======================================================================
    // SLIPSMITH MINIMUM PICK COUNT ENFORCEMENT
    // Enforce sport-specific minimum if caller's limit is too low
    // =======================================================================
    const requiredMin = getRequiredMinByLeague(league);
    const effectiveLimit = Math.max(limit, requiredMin);

    // Generate projections
    const projections = await this.projectionEngine.generateProjections(league, date);

    // Get consensus lines
    const lines = this.generateMockLines(projections, league);

    // Get reliability scores
    const reliabilityScores = this.evaluationEngine.getReliabilityScores(sport, league);

    // Find edges
    let allEvents = this.edgeDetector.findEdges(projections, lines, reliabilityScores);

    // =======================================================================
    // SLIPSMITH GREEN/YELLOW EVENT CATEGORIZATION
    // Split events by probability tier for proper selection prioritization:
    // - greenEvents: probability > 0.77 (high confidence, selected first)
    // - yellowEvents: 0.60 <= probability <= 0.77 (moderate confidence, fill after green)
    // - redEvents: probability < 0.60 (never included in SlipSmith slips)
    // =======================================================================
    const greenEvents: Event[] = [];
    const yellowEvents: Event[] = [];
    
    for (const event of allEvents) {
      // =======================================================================
      // RELIABILITY INTEGRATION INTO EFFECTIVE PROBABILITY
      // If a player/market has reliability data, adjust the effective probability
      // slightly to account for historical accuracy. This is a conservative adjustment
      // to prevent over-reliance on unreliable projections.
      //
      // Adjustment formula: effectiveProb = probability * (0.9 + 0.1 * reliability)
      // - If reliability = 0.5 (neutral): effectiveProb = probability * 0.95
      // - If reliability = 1.0 (perfect): effectiveProb = probability * 1.0
      // - If reliability = 0.0 (poor): effectiveProb = probability * 0.9
      //
      // This gives a ±5% adjustment based on reliability, which is conservative
      // but enough to influence borderline cases.
      // =======================================================================
      const reliability = event.reliability ?? 0.5;
      const reliabilityFactor = 0.9 + (0.1 * reliability);
      const effectiveProb = event.probability * reliabilityFactor;
      
      // Categorize by effective probability
      if (effectiveProb > GREEN_PROBABILITY_THRESHOLD) {
        greenEvents.push(event);
      } else if (effectiveProb >= SLIPSMITH_MIN_PROBABILITY) {
        yellowEvents.push(event);
      }
      // Red events (effectiveProb < 0.60) are intentionally excluded
    }

    // Sort both arrays by probability (highest first)
    greenEvents.sort((a, b) => b.probability - a.probability);
    yellowEvents.sort((a, b) => b.probability - a.probability);

    // =======================================================================
    // SLIPSMITH EVENT SELECTION STRATEGY
    // 1. Start with all green events (highest confidence first)
    // 2. Fill with yellow events if we haven't reached effectiveLimit
    // 3. Never include red events
    // =======================================================================
    let selectedEvents: Event[] = [...greenEvents];
    
    // Fill with yellow events if needed
    if (selectedEvents.length < effectiveLimit) {
      const slotsRemaining = effectiveLimit - selectedEvents.length;
      selectedEvents = selectedEvents.concat(yellowEvents.slice(0, slotsRemaining));
    }

    // Cap at effectiveLimit
    selectedEvents = selectedEvents.slice(0, effectiveLimit);

    // =======================================================================
    // SLIPSMITH WARNING MESSAGE GENERATION
    // Warn if we couldn't meet the required minimum for this sport
    // =======================================================================
    const warnings: string[] = [];
    
    if (this.config.providerConfig?.useMockData) {
      warnings.push('Using mock data for demonstration. Connect real API providers for production use.');
    }
    
    const eligibleCount = greenEvents.length + yellowEvents.length;
    if (eligibleCount < requiredMin) {
      warnings.push(
        `Only ${eligibleCount} events met the minimum 60% probability threshold for ${league} on this date.`
      );
    }
    
    const warning = warnings.length > 0 ? warnings.join(' ') : undefined;

    // Store for later evaluation
    this.evaluationEngine.storeEvents(selectedEvents);

    // Build and return SlipSmith Slip
    return buildSlipSmithSlip(selectedEvents, date, sport, league, tier, warning);
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

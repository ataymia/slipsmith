/**
 * Events Handler
 * 
 * Gets top events (edges) for betting opportunities.
 * Works across Express and Cloudflare Workers.
 */

import type { 
  League, 
  Sport, 
  Event,
  EventsResponse,
  ConsensusLine,
  MarketType,
  SlipSmithSlip,
  SlipTier,
} from '../../types';
import { ProviderFactory, ProviderConfig } from '../../providers';
import { ProjectionEngine, EdgeDetector } from '../../engine';
import { 
  buildSlipSmithSlip,
  normalizeTier,
} from '../../utils/slipBuilder';
import { 
  EnvBindings, 
  EventsParams,
  TopEventsParams,
  getProviderConfig,
  isMockMode,
} from './types';

export interface EventsResult {
  success: boolean;
  response?: EventsResponse;
  error?: string;
  status: number;
}

export interface TopEventsResult {
  success: boolean;
  slip?: SlipSmithSlip;
  error?: string;
  status: number;
}

/**
 * Generate mock consensus lines for testing
 * In production, these would come from a lines provider
 */
function generateMockLines(projections: any[], league: League): ConsensusLine[] {
  const lines: ConsensusLine[] = [];
  
  for (const game of projections) {
    // Generate player lines
    for (const player of game.players) {
      for (const [stat, value] of Object.entries(player.projectedStats)) {
        if (typeof value !== 'number') continue;
        
        const market = statToMarket(stat);
        if (!market) continue;
        
        // Create line with slight offset from projection
        const offset = (Math.random() - 0.5) * getMarketVariance(market);
        const line = Math.round((value + offset) * 2) / 2; // Round to nearest 0.5
        
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

function statToMarket(stat: string): string | null {
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

function getMarketVariance(market: string): number {
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

/**
 * Get events (edges) for a league and date - Legacy endpoint
 */
export async function handleEvents(
  params: EventsParams,
  env: EnvBindings
): Promise<EventsResult> {
  try {
    const { league, date, limit = 20, minProbability = 0.5 } = params;
    
    // Create provider factory with config from environment
    const config: ProviderConfig = getProviderConfig(env);
    const providerFactory = new ProviderFactory(config);
    const projectionEngine = new ProjectionEngine(providerFactory);
    const edgeDetector = new EdgeDetector();
    
    // Generate projections
    const projections = await projectionEngine.generateProjections(league, date);
    
    // Get consensus lines (in production, fetch from lines provider)
    const lines = generateMockLines(projections, league);
    
    // Find edges (reliability scores would come from evaluation engine in production)
    let events = edgeDetector.findEdges(projections, lines);
    
    // Filter by probability
    events = edgeDetector.filterByProbability(events, minProbability);
    
    // Get top events
    events = edgeDetector.getTopEvents(events, limit);
    
    // Get sport for this league
    const sport = providerFactory.getSportForLeague(league);
    
    const response: EventsResponse = {
      success: true,
      date,
      sport,
      league,
      events,
      totalEvents: events.length,
      generatedAt: new Date().toISOString(),
    };
    
    return {
      success: true,
      response,
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get events',
      status: 400,
    };
  }
}

/**
 * Get top events in SlipSmith format
 */
export async function handleTopEvents(
  params: TopEventsParams,
  env: EnvBindings
): Promise<TopEventsResult> {
  try {
    const { 
      date, 
      sport: sportQuery, 
      tier: tierQuery = 'starter', 
      limit = 20, 
      minProbability = 0.5 
    } = params;
    
    // Validate required parameters
    if (!date) {
      return {
        success: false,
        error: 'Missing required parameter: date (format: YYYY-MM-DD)',
        status: 400,
      };
    }
    
    if (!sportQuery) {
      return {
        success: false,
        error: 'Missing required parameter: sport (e.g., NBA, NFL)',
        status: 400,
      };
    }
    
    // Normalize tier
    const tier = normalizeTier(tierQuery);
    
    // Map sport query to league (sport query can be league identifier)
    const league = sportQuery.toUpperCase() as League;
    
    // Create provider factory with config from environment
    const config: ProviderConfig = getProviderConfig(env);
    const providerFactory = new ProviderFactory(config);
    
    // Get sport for this league
    let sport: Sport;
    try {
      sport = providerFactory.getSportForLeague(league);
    } catch {
      return {
        success: false,
        error: `Unknown sport/league: ${sportQuery}`,
        status: 400,
      };
    }
    
    const projectionEngine = new ProjectionEngine(providerFactory);
    const edgeDetector = new EdgeDetector();
    
    // Generate projections
    const projections = await projectionEngine.generateProjections(league, date);
    
    // Get consensus lines
    const lines = generateMockLines(projections, league);
    
    // Find edges
    let events = edgeDetector.findEdges(projections, lines);
    
    // Filter by probability
    events = edgeDetector.filterByProbability(events, minProbability);
    
    // Get top events
    events = edgeDetector.getTopEvents(events, limit);
    
    // Build warning message if using mock data
    let warning: string | undefined;
    if (isMockMode(env)) {
      warning = 'Using mock data for demonstration. Connect real API providers for production use.';
    }
    
    // Build SlipSmith Slip in official export format
    const slip: SlipSmithSlip = buildSlipSmithSlip(
      events,
      date,
      sport,
      league,
      tier,
      warning
    );
    
    return {
      success: true,
      slip,
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get top events',
      status: 400,
    };
  }
}

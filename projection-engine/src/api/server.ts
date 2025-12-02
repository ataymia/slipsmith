/**
 * SlipSmith API Server
 * 
 * Express server providing REST API endpoints for the projection engine.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { 
  Sport, 
  League, 
  MarketType,
  ProjectionResponse, 
  EventsResponse, 
  EvaluationResponse,
  ConsensusLine,
  SlipSmithSlip,
  SlipTier,
} from '../types';
import { ProviderFactory, ProviderConfig } from '../providers';
import { ProjectionEngine, EdgeDetector } from '../engine';
import { EvaluationEngine } from '../evaluation';
import { 
  buildSlipSmithSlip, 
  normalizeTier,
  isValidTier,
} from '../utils/slipBuilder';

export interface ApiConfig {
  port: number;
  dbPath: string;
  providerConfig: ProviderConfig;
}

const DEFAULT_API_CONFIG: ApiConfig = {
  port: 3001,
  dbPath: './data/slipsmith.db',
  providerConfig: {
    useMockData: false,
  },
};

export function createApiServer(config: Partial<ApiConfig> = {}) {
  const fullConfig = { ...DEFAULT_API_CONFIG, ...config };
  
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Initialize components
  const providerFactory = new ProviderFactory(fullConfig.providerConfig);
  const projectionEngine = new ProjectionEngine(providerFactory);
  const edgeDetector = new EdgeDetector();
  const evaluationEngine = new EvaluationEngine(fullConfig.dbPath, providerFactory);
  
  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });
  
  // Get supported sports and leagues
  app.get('/api/sports', (req: Request, res: Response) => {
    const sports = providerFactory.getSupportedSports();
    const result: Record<Sport, League[]> = {} as any;
    
    for (const sport of sports) {
      result[sport] = providerFactory.getSupportedLeagues(sport);
    }
    
    res.json({ sports: result });
  });
  
  // Get schedule for a date and league
  app.get('/api/schedule/:league/:date', async (req: Request, res: Response) => {
    try {
      const { league, date } = req.params;
      const provider = providerFactory.getProviderForLeague(league as League);
      const schedule = await provider.getSchedule(league as League, date);
      
      res.json({
        success: true,
        ...schedule,
      });
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Generate projections
  app.get('/api/projections/:league/:date', async (req: Request, res: Response) => {
    try {
      const { league, date } = req.params;
      const projections = await projectionEngine.generateProjections(
        league as League, 
        date
      );
      
      const sport = providerFactory.getSportForLeague(league as League);
      
      const response: ProjectionResponse = {
        success: true,
        date,
        sport,
        league: league as League,
        games: projections,
        generatedAt: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Get top events (edges) - Legacy endpoint
  app.get('/api/events/:league/:date', async (req: Request, res: Response) => {
    try {
      const { league, date } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const minProbability = parseFloat(req.query.minProbability as string) || 0.5;
      
      // Generate projections
      const projections = await projectionEngine.generateProjections(
        league as League, 
        date
      );
      
      // Get consensus lines (in production, fetch from lines provider)
      // For now, generate mock lines based on projections
      const lines = generateMockLines(projections, league as League);
      
      // Get reliability scores
      const sport = providerFactory.getSportForLeague(league as League);
      const reliabilityScores = evaluationEngine.getReliabilityScores(sport, league as League);
      
      // Find edges
      let events = edgeDetector.findEdges(projections, lines, reliabilityScores);
      
      // Filter by probability
      events = edgeDetector.filterByProbability(events, minProbability);
      
      // Get top events
      events = edgeDetector.getTopEvents(events, limit);
      
      // Store for later evaluation
      evaluationEngine.storeEvents(events);
      
      const response: EventsResponse = {
        success: true,
        date,
        sport,
        league: league as League,
        events,
        totalEvents: events.length,
        generatedAt: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  /**
   * Get Top Events - SlipSmith Export Format
   * 
   * Returns events in the official SlipSmith JSON schema.
   * This is the preferred endpoint for external consumers.
   * 
   * Query Parameters:
   * - date: YYYY-MM-DD format (required)
   * - sport: Sport/League identifier (required, e.g., "NBA", "NFL")
   * - tier: Tier level - "starter", "pro", or "vip" (optional, defaults to "starter")
   * - limit: Maximum number of events to return (optional, defaults to 20)
   * - minProbability: Minimum probability filter 0-1 (optional, defaults to 0.5)
   */
  app.get('/api/top-events', async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      const sportQuery = req.query.sport as string;
      const tierQuery = (req.query.tier as string) || 'starter';
      const limit = parseInt(req.query.limit as string) || 20;
      const minProbability = parseFloat(req.query.minProbability as string) || 0.5;
      
      // Validate required parameters
      if (!date) {
        return res.status(400).json({
          error: 'Missing required parameter: date (format: YYYY-MM-DD)',
        });
      }
      
      if (!sportQuery) {
        return res.status(400).json({
          error: 'Missing required parameter: sport (e.g., NBA, NFL)',
        });
      }
      
      // Validate and normalize tier
      const tier = normalizeTier(tierQuery);
      
      // Map sport query to league (sport query can be league identifier)
      const league = sportQuery.toUpperCase() as League;
      
      // Get sport for this league
      let sport: Sport;
      try {
        sport = providerFactory.getSportForLeague(league);
      } catch {
        return res.status(400).json({
          error: `Unknown sport/league: ${sportQuery}`,
        });
      }
      
      // Generate projections
      const projections = await projectionEngine.generateProjections(league, date);
      
      // Get consensus lines
      const lines = generateMockLines(projections, league);
      
      // Get reliability scores
      const reliabilityScores = evaluationEngine.getReliabilityScores(sport, league);
      
      // Find edges
      let events = edgeDetector.findEdges(projections, lines, reliabilityScores);
      
      // Filter by probability
      events = edgeDetector.filterByProbability(events, minProbability);
      
      // Get top events
      events = edgeDetector.getTopEvents(events, limit);
      
      // Store for later evaluation
      evaluationEngine.storeEvents(events);
      
      // Build warning message if using mock data
      let warning: string | undefined;
      if (fullConfig.providerConfig.useMockData) {
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
      
      res.json(slip);
    } catch (error: any) {
      res.status(400).json({
        error: error.message,
      });
    }
  });
  
  // Evaluate past predictions
  app.post('/api/evaluate/:date', async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const evaluated = await evaluationEngine.evaluateDate(date);
      
      const summary = {
        total: evaluated.length,
        hits: evaluated.filter(e => e.result === 'hit').length,
        misses: evaluated.filter(e => e.result === 'miss').length,
        pushes: evaluated.filter(e => e.result === 'push').length,
        voids: evaluated.filter(e => e.result === 'void').length,
        hitRate: 0,
      };
      
      const decidedBets = summary.hits + summary.misses;
      summary.hitRate = decidedBets > 0 ? summary.hits / decidedBets : 0;
      
      const response: EvaluationResponse = {
        success: true,
        date,
        evaluated,
        summary,
      };
      
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Get evaluation summary
  app.get('/api/summary', (req: Request, res: Response) => {
    try {
      const startDate = (req.query.startDate as string) || '2024-01-01';
      const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];
      
      const summary = evaluationEngine.getSummary(startDate, endDate as string);
      
      res.json({
        success: true,
        startDate,
        endDate,
        ...summary,
      });
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Get reliability report
  app.get('/api/reliability', (req: Request, res: Response) => {
    try {
      const sport = req.query.sport as Sport | undefined;
      const report = evaluationEngine.getReliabilityReport(sport);
      
      res.json({
        success: true,
        report,
      });
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  });
  
  return {
    app,
    start: () => {
      app.listen(fullConfig.port, () => {
        console.log(`SlipSmith API running on port ${fullConfig.port}`);
      });
    },
    close: () => {
      evaluationEngine.close();
    },
  };
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

export default createApiServer;

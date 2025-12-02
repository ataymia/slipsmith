/**
 * Evaluation Engine
 * 
 * Compares projected outcomes with actual box scores and maintains
 * historical reliability scores for learning and improvement.
 */

import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import {
  Sport,
  League,
  Event,
  EvaluatedEvent,
  EventResult,
  ReliabilityScore,
  MarketType,
  GameProjection,
  PlayerStats,
} from '../types';
import { ProviderFactory } from '../providers';

/**
 * Database row type for projections table
 */
interface ProjectionRow {
  id: string;
  date: string;
  sport: string;
  league: string;
  game_id: string;
  player_id: string | null;
  team_id: string | null;
  market: string;
  line: number;
  direction: string;
  model_projection: number;
  probability: number;
  edge_score: number;
  reasoning: string | null;
  created_at: string;
}

/**
 * Database schema for the evaluation/learning system
 */
const SCHEMA = `
  -- Historical projections
  CREATE TABLE IF NOT EXISTS projections (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    game_id TEXT NOT NULL,
    player_id TEXT,
    team_id TEXT,
    market TEXT NOT NULL,
    line REAL NOT NULL,
    direction TEXT NOT NULL,
    model_projection REAL NOT NULL,
    probability REAL NOT NULL,
    edge_score REAL NOT NULL,
    reasoning TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Evaluation results
  CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    projection_id TEXT NOT NULL,
    actual_value REAL,
    result TEXT NOT NULL,
    evaluated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projection_id) REFERENCES projections(id)
  );
  
  -- Reliability scores
  CREATE TABLE IF NOT EXISTS reliability_scores (
    id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    player_id TEXT,
    team_id TEXT,
    market TEXT NOT NULL,
    total_bets INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    pushes INTEGER DEFAULT 0,
    voids INTEGER DEFAULT 0,
    hit_rate REAL DEFAULT 0,
    average_edge REAL DEFAULT 0,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport, league, player_id, team_id, market)
  );
  
  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_projections_date ON projections(date);
  CREATE INDEX IF NOT EXISTS idx_projections_game ON projections(game_id);
  CREATE INDEX IF NOT EXISTS idx_evaluations_result ON evaluations(result);
  CREATE INDEX IF NOT EXISTS idx_reliability_market ON reliability_scores(sport, market);
`;

export class EvaluationEngine {
  private db: Database.Database;
  private providerFactory: ProviderFactory;
  
  constructor(dbPath: string, providerFactory: ProviderFactory) {
    this.db = new Database(dbPath);
    this.providerFactory = providerFactory;
    this.initializeDatabase();
  }
  
  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    this.db.exec(SCHEMA);
  }
  
  /**
   * Store events/projections for later evaluation
   */
  storeEvents(events: Event[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO projections 
      (id, date, sport, league, game_id, player_id, team_id, market, 
       line, direction, model_projection, probability, edge_score, reasoning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = this.db.transaction((events: Event[]) => {
      for (const event of events) {
        insert.run(
          event.eventId,
          event.date,
          event.sport,
          event.league,
          event.gameId,
          event.playerId ?? null,
          event.teamId ?? null,
          event.market,
          event.line,
          event.direction,
          event.modelProjection,
          event.probability,
          event.edgeScore,
          event.reasoning
        );
      }
    });
    
    insertMany(events);
  }
  
  /**
   * Evaluate events for a given date
   */
  async evaluateDate(date: string): Promise<EvaluatedEvent[]> {
    // Get all unevaluated projections for this date
    const projections = this.db.prepare(`
      SELECT p.* FROM projections p
      LEFT JOIN evaluations e ON p.id = e.projection_id
      WHERE p.date = ? AND e.id IS NULL
    `).all(date) as ProjectionRow[];
    
    if (projections.length === 0) {
      return [];
    }
    
    const evaluated: EvaluatedEvent[] = [];
    
    // Group by game to minimize API calls
    const gameGroups = new Map<string, ProjectionRow[]>();
    for (const proj of projections) {
      const games = gameGroups.get(proj.game_id) ?? [];
      games.push(proj);
      gameGroups.set(proj.game_id, games);
    }
    
    // Evaluate each game
    for (const [gameId, gameProjs] of gameGroups) {
      const league = gameProjs[0].league as League;
      const provider = this.providerFactory.getProviderForLeague(league);
      
      try {
        const boxScore = await provider.getGameBoxScore(gameId);
        
        if (!boxScore) {
          // Game not yet completed
          continue;
        }
        
        // Create stats lookup
        const playerStats = new Map<string, PlayerStats>();
        for (const stat of [...boxScore.home.players, ...boxScore.away.players]) {
          playerStats.set(stat.playerId, stat);
        }
        
        // Evaluate each projection
        for (const proj of gameProjs) {
          const result = this.evaluateProjection(proj, playerStats, boxScore);
          
          if (result) {
            evaluated.push(result);
            
            // Store evaluation
            this.storeEvaluation(proj.id, result.actualValue, result.result);
            
            // Update reliability scores
            this.updateReliability(proj, result.result);
          }
        }
      } catch (error) {
        console.error(`Error evaluating game ${gameId}:`, error);
      }
    }
    
    return evaluated;
  }
  
  /**
   * Evaluate a single projection against actual stats
   */
  private evaluateProjection(
    proj: any,
    playerStats: Map<string, PlayerStats>,
    boxScore: any
  ): EvaluatedEvent | null {
    let actualValue: number | undefined;
    
    if (proj.player_id) {
      // Player prop
      const stats = playerStats.get(proj.player_id);
      if (!stats) return null;
      
      actualValue = this.getStatValue(stats, proj.market);
    } else if (proj.team_id) {
      // Team prop
      const teamData = proj.team_id === boxScore.home.team.teamId 
        ? boxScore.home.team 
        : boxScore.away.team;
      
      if (proj.market === 'TEAM_TOTAL') {
        actualValue = teamData.projectedScore;
      } else if (proj.market === 'GAME_TOTAL') {
        actualValue = boxScore.home.team.projectedScore + boxScore.away.team.projectedScore;
      }
    }
    
    if (actualValue === undefined) {
      return null;
    }
    
    // Determine result
    let result: EventResult;
    
    if (actualValue === proj.line) {
      result = 'push';
    } else if (proj.direction === 'over') {
      result = actualValue > proj.line ? 'hit' : 'miss';
    } else {
      result = actualValue < proj.line ? 'hit' : 'miss';
    }
    
    return {
      eventId: proj.id,
      date: proj.date,
      sport: proj.sport,
      league: proj.league,
      gameId: proj.game_id,
      playerId: proj.player_id,
      teamId: proj.team_id,
      market: proj.market,
      line: proj.line,
      direction: proj.direction,
      modelProjection: proj.model_projection,
      probability: proj.probability,
      edgeScore: proj.edge_score,
      reasoning: proj.reasoning,
      confidence: proj.probability,
      actualValue,
      result,
      evaluatedAt: new Date(),
    };
  }
  
  /**
   * Get stat value from player stats based on market type
   */
  private getStatValue(stats: PlayerStats, market: MarketType): number | undefined {
    const mapping: Record<string, string> = {
      'POINTS': 'points',
      'REBOUNDS': 'rebounds',
      'ASSISTS': 'assists',
      'THREES': 'threePointersMade',
      'PASSING_YARDS': 'passingYards',
      'RUSHING_YARDS': 'rushingYards',
      'RECEIVING_YARDS': 'receivingYards',
      'RECEPTIONS': 'receptions',
      'GOALS': 'goals',
      'KILLS': 'kills',
    };
    
    const key = mapping[market];
    if (key && key in stats) {
      return (stats as unknown as Record<string, unknown>)[key] as number;
    }
    
    return undefined;
  }
  
  /**
   * Store evaluation result
   */
  private storeEvaluation(projectionId: string, actualValue: number | undefined, result: EventResult): void {
    this.db.prepare(`
      INSERT INTO evaluations (id, projection_id, actual_value, result)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), projectionId, actualValue ?? null, result);
  }
  
  /**
   * Update reliability scores based on evaluation
   */
  private updateReliability(proj: any, result: EventResult): void {
    const key = `${proj.sport}_${proj.league}_${proj.player_id ?? 'null'}_${proj.team_id ?? 'null'}_${proj.market}`;
    
    // Get or create reliability score
    let score = this.db.prepare(`
      SELECT * FROM reliability_scores
      WHERE sport = ? AND league = ? AND 
            (player_id = ? OR (player_id IS NULL AND ? IS NULL)) AND
            (team_id = ? OR (team_id IS NULL AND ? IS NULL)) AND
            market = ?
    `).get(
      proj.sport, proj.league, 
      proj.player_id, proj.player_id,
      proj.team_id, proj.team_id,
      proj.market
    ) as any;
    
    if (!score) {
      // Create new score
      this.db.prepare(`
        INSERT INTO reliability_scores 
        (id, sport, league, player_id, team_id, market)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuid(), proj.sport, proj.league, proj.player_id, proj.team_id, proj.market);
      
      score = {
        total_bets: 0,
        hits: 0,
        misses: 0,
        pushes: 0,
        voids: 0,
      };
    }
    
    // Update counts
    const newTotal = score.total_bets + (result !== 'void' ? 1 : 0);
    const newHits = score.hits + (result === 'hit' ? 1 : 0);
    const newMisses = score.misses + (result === 'miss' ? 1 : 0);
    const newPushes = score.pushes + (result === 'push' ? 1 : 0);
    const newVoids = score.voids + (result === 'void' ? 1 : 0);
    const newHitRate = newTotal > 0 ? newHits / (newHits + newMisses) : 0;
    
    this.db.prepare(`
      UPDATE reliability_scores
      SET total_bets = ?, hits = ?, misses = ?, pushes = ?, voids = ?,
          hit_rate = ?, last_updated = CURRENT_TIMESTAMP
      WHERE sport = ? AND league = ? AND 
            (player_id = ? OR (player_id IS NULL AND ? IS NULL)) AND
            (team_id = ? OR (team_id IS NULL AND ? IS NULL)) AND
            market = ?
    `).run(
      newTotal, newHits, newMisses, newPushes, newVoids, newHitRate,
      proj.sport, proj.league,
      proj.player_id, proj.player_id,
      proj.team_id, proj.team_id,
      proj.market
    );
  }
  
  /**
   * Get reliability scores for edge detection
   */
  getReliabilityScores(sport?: Sport, league?: League): Map<string, number> {
    let query = 'SELECT * FROM reliability_scores WHERE 1=1';
    const params: any[] = [];
    
    if (sport) {
      query += ' AND sport = ?';
      params.push(sport);
    }
    
    if (league) {
      query += ' AND league = ?';
      params.push(league);
    }
    
    const scores = this.db.prepare(query).all(...params) as any[];
    const result = new Map<string, number>();
    
    for (const score of scores) {
      const key = `${score.player_id ?? score.team_id}_${score.market}`;
      result.set(key, score.hit_rate);
    }
    
    return result;
  }
  
  /**
   * Get evaluation summary for a date range
   */
  getSummary(startDate: string, endDate: string): {
    total: number;
    hits: number;
    misses: number;
    pushes: number;
    voids: number;
    hitRate: number;
    averageEdge: number;
  } {
    const result = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) as hits,
        SUM(CASE WHEN e.result = 'miss' THEN 1 ELSE 0 END) as misses,
        SUM(CASE WHEN e.result = 'push' THEN 1 ELSE 0 END) as pushes,
        SUM(CASE WHEN e.result = 'void' THEN 1 ELSE 0 END) as voids,
        AVG(p.edge_score) as average_edge
      FROM evaluations e
      JOIN projections p ON e.projection_id = p.id
      WHERE p.date BETWEEN ? AND ?
    `).get(startDate, endDate) as any;
    
    const decidedBets = (result.hits ?? 0) + (result.misses ?? 0);
    
    return {
      total: result.total ?? 0,
      hits: result.hits ?? 0,
      misses: result.misses ?? 0,
      pushes: result.pushes ?? 0,
      voids: result.voids ?? 0,
      hitRate: decidedBets > 0 ? result.hits / decidedBets : 0,
      averageEdge: result.average_edge ?? 0,
    };
  }
  
  /**
   * Get detailed reliability report
   */
  getReliabilityReport(sport?: Sport): ReliabilityScore[] {
    let query = 'SELECT * FROM reliability_scores WHERE 1=1';
    const params: any[] = [];
    
    if (sport) {
      query += ' AND sport = ?';
      params.push(sport);
    }
    
    query += ' ORDER BY hit_rate DESC, total_bets DESC';
    
    const rows = this.db.prepare(query).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      sport: row.sport,
      league: row.league,
      playerId: row.player_id,
      teamId: row.team_id,
      market: row.market,
      totalBets: row.total_bets,
      hits: row.hits,
      misses: row.misses,
      pushes: row.pushes,
      voids: row.voids,
      hitRate: row.hit_rate,
      averageEdge: row.average_edge,
      lastUpdated: new Date(row.last_updated),
    }));
  }
  
  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default EvaluationEngine;

/**
 * Edge Detector
 * 
 * Compares model projections with consensus lines to find high-value
 * betting opportunities ("edges"). Ranks events by edge score and probability.
 */

import {
  Sport,
  League,
  GameProjection,
  PlayerProjection,
  ConsensusLine,
  Event,
  MarketType,
  Direction,
} from '../types';
import { v4 as uuid } from 'uuid';

/**
 * Edge Detection Configuration
 */
export interface EdgeConfig {
  // Minimum edge (difference) to consider
  minEdge: number;
  
  // Edge scoring weights
  edgeWeight: number;
  confidenceWeight: number;
  reliabilityWeight: number;
  
  // Market-specific thresholds
  marketThresholds: Partial<Record<MarketType, number>>;
}

const DEFAULT_EDGE_CONFIG: EdgeConfig = {
  minEdge: 0.5, // Minimum 0.5 unit edge
  edgeWeight: 0.5,
  confidenceWeight: 0.3,
  reliabilityWeight: 0.2,
  marketThresholds: {
    POINTS: 1.5,
    REBOUNDS: 1.0,
    ASSISTS: 0.8,
    THREES: 0.5,
    PASSING_YARDS: 15,
    RUSHING_YARDS: 10,
    RECEIVING_YARDS: 10,
    RECEPTIONS: 1.0,
    GOALS: 0.3,
    KILLS: 1.0,
  },
};

export class EdgeDetector {
  private config: EdgeConfig;
  
  constructor(config: Partial<EdgeConfig> = {}) {
    this.config = { ...DEFAULT_EDGE_CONFIG, ...config };
  }
  
  /**
   * Find edges between projections and consensus lines
   */
  findEdges(
    projections: GameProjection[],
    lines: ConsensusLine[],
    reliabilityScores?: Map<string, number>
  ): Event[] {
    const events: Event[] = [];
    
    // Create lookup maps
    const playerProjectionMap = new Map<string, PlayerProjection>();
    const gameProjectionMap = new Map<string, GameProjection>();
    
    for (const projection of projections) {
      gameProjectionMap.set(projection.gameId, projection);
      
      for (const player of projection.players) {
        playerProjectionMap.set(`${projection.gameId}_${player.playerId}`, player);
      }
    }
    
    // Process each line
    for (const line of lines) {
      let event: Event | null = null;
      
      if (line.playerId) {
        // Player prop
        const key = `${line.gameId}_${line.playerId}`;
        const playerProjection = playerProjectionMap.get(key);
        
        if (playerProjection) {
          event = this.evaluatePlayerProp(line, playerProjection, reliabilityScores);
        }
      } else if (line.teamId) {
        // Team prop
        const gameProjection = gameProjectionMap.get(line.gameId);
        
        if (gameProjection) {
          event = this.evaluateTeamProp(line, gameProjection, reliabilityScores);
        }
      }
      
      if (event && Math.abs(event.edgeScore) >= this.config.minEdge) {
        events.push(event);
      }
    }
    
    // Sort by edge score (highest first)
    return events.sort((a, b) => b.edgeScore - a.edgeScore);
  }
  
  /**
   * Evaluate a player prop line against projection
   */
  private evaluatePlayerProp(
    line: ConsensusLine,
    projection: PlayerProjection,
    reliabilityScores?: Map<string, number>
  ): Event | null {
    // Map market type to stat key
    const statKey = this.marketToStatKey(line.market);
    if (!statKey) return null;
    
    const projectedValue = projection.projectedStats[statKey];
    if (projectedValue === undefined) return null;
    
    // Calculate edge
    const edge = projectedValue - line.line;
    const absEdge = Math.abs(edge);
    
    // Determine direction
    const direction: Direction = edge > 0 ? 'over' : 'under';
    
    // Get market threshold
    const threshold = this.config.marketThresholds[line.market] ?? 1.0;
    
    // Calculate probability (simplified model)
    // In production, use more sophisticated statistical models
    const probability = this.calculateProbability(edge, threshold);
    
    // Get reliability score if available
    const reliabilityKey = `${line.playerId}_${line.market}`;
    const reliability = reliabilityScores?.get(reliabilityKey) ?? 0.5;
    
    // Calculate final edge score
    const edgeScore = this.calculateEdgeScore(absEdge, threshold, projection.confidence, reliability);
    
    // Generate reasoning
    const reasoning = this.generateReasoning(
      line.playerName ?? 'Player',
      line.market,
      projectedValue,
      line.line,
      direction,
      projection
    );
    
    return {
      eventId: uuid(),
      date: projection.gameId.split('_')[0] ?? new Date().toISOString().split('T')[0] as string,
      sport: projection.sport,
      league: projection.league,
      gameId: projection.gameId,
      playerId: line.playerId,
      playerName: line.playerName,
      teamId: line.teamId,
      teamName: line.teamName,
      market: line.market,
      line: line.line,
      direction,
      modelProjection: Math.round(projectedValue * 10) / 10,
      probability,
      edgeScore: Math.round(edgeScore * 100) / 100,
      reasoning,
      reliability,
      confidence: projection.confidence,
    };
  }
  
  /**
   * Evaluate a team prop line against projection
   */
  private evaluateTeamProp(
    line: ConsensusLine,
    projection: GameProjection,
    reliabilityScores?: Map<string, number>
  ): Event | null {
    let projectedValue: number | undefined;
    
    // Determine which team and what stat
    const isHomeTeam = line.teamId === projection.homeTeam.teamId;
    const teamProjection = isHomeTeam ? projection.homeTeam : projection.awayTeam;
    
    if (line.market === 'TEAM_TOTAL') {
      projectedValue = teamProjection.projectedScore;
    } else if (line.market === 'GAME_TOTAL') {
      projectedValue = projection.homeTeam.projectedScore + projection.awayTeam.projectedScore;
    }
    
    if (projectedValue === undefined) return null;
    
    // Calculate edge
    const edge = projectedValue - line.line;
    const absEdge = Math.abs(edge);
    const direction: Direction = edge > 0 ? 'over' : 'under';
    
    // Get threshold for team totals (varies by sport)
    let threshold = 3;
    if (projection.sport === 'basketball') threshold = 5;
    if (projection.sport === 'soccer') threshold = 0.5;
    
    const probability = this.calculateProbability(edge, threshold);
    const reliability = reliabilityScores?.get(`${line.teamId}_${line.market}`) ?? 0.5;
    const edgeScore = this.calculateEdgeScore(absEdge, threshold, teamProjection.confidence, reliability);
    
    const reasoning = `${line.teamName} projected for ${projectedValue.toFixed(1)} ${line.market === 'GAME_TOTAL' ? 'total points' : 'points'}, line set at ${line.line}. ${direction.toUpperCase()} looks favorable.`;
    
    return {
      eventId: uuid(),
      date: projection.date,
      sport: projection.sport,
      league: projection.league,
      gameId: projection.gameId,
      teamId: line.teamId,
      teamName: line.teamName,
      market: line.market,
      line: line.line,
      direction,
      modelProjection: Math.round(projectedValue * 10) / 10,
      probability,
      edgeScore: Math.round(edgeScore * 100) / 100,
      reasoning,
      reliability,
      confidence: teamProjection.confidence,
    };
  }
  
  /**
   * Map market type to projection stat key
   */
  private marketToStatKey(market: MarketType): string | null {
    const mapping: Partial<Record<MarketType, string>> = {
      POINTS: 'points',
      REBOUNDS: 'rebounds',
      ASSISTS: 'assists',
      THREES: 'threePointersMade',
      STOCKS: 'stocks', // steals + blocks
      PRA: 'pra', // points + rebounds + assists
      PR: 'pr',
      PA: 'pa',
      RA: 'ra',
      PASSING_YARDS: 'passingYards',
      RUSHING_YARDS: 'rushingYards',
      RECEIVING_YARDS: 'receivingYards',
      RECEPTIONS: 'receptions',
      PASSING_TDS: 'passingTouchdowns',
      RUSHING_TDS: 'rushingTouchdowns',
      RECEIVING_TDS: 'receivingTouchdowns',
      INTERCEPTIONS: 'interceptions',
      GOALS: 'goals',
      SOCCER_ASSISTS: 'assists',
      SHOTS: 'shots',
      SHOTS_ON_TARGET: 'shotsOnTarget',
      TACKLES: 'tackles',
      KILLS: 'kills',
      DEATHS: 'deaths',
      ESPORTS_ASSISTS: 'assists',
      CS: 'cs',
      KDA: 'kda',
    };
    
    return mapping[market] ?? null;
  }
  
  /**
   * Calculate probability using normal distribution approximation
   */
  private calculateProbability(edge: number, threshold: number): number {
    // Simplified probability model
    // In production, use proper statistical distributions
    const zScore = edge / threshold;
    const probability = 0.5 + 0.5 * this.erf(zScore / Math.sqrt(2));
    
    return Math.round(probability * 100) / 100;
  }
  
  /**
   * Error function approximation for probability calculation
   */
  private erf(x: number): number {
    // Approximation of the error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
  
  /**
   * Calculate final edge score combining all factors
   */
  private calculateEdgeScore(
    absEdge: number,
    threshold: number,
    confidence: number,
    reliability: number
  ): number {
    const normalizedEdge = absEdge / threshold;
    
    return (
      normalizedEdge * this.config.edgeWeight +
      confidence * this.config.confidenceWeight +
      reliability * this.config.reliabilityWeight
    ) * 10; // Scale to 0-10 range
  }
  
  /**
   * Generate human-readable reasoning for an edge
   */
  private generateReasoning(
    playerName: string,
    market: MarketType,
    projection: number,
    line: number,
    direction: Direction,
    playerProjection: PlayerProjection
  ): string {
    const marketName = market.toLowerCase().replace(/_/g, ' ');
    const edge = Math.abs(projection - line);
    
    let reason = `${playerName} projected for ${projection.toFixed(1)} ${marketName}, line set at ${line}. `;
    
    if (edge >= 3) {
      reason += `Strong ${direction} opportunity with ${edge.toFixed(1)} unit edge. `;
    } else if (edge >= 1.5) {
      reason += `Moderate ${direction} value with ${edge.toFixed(1)} unit edge. `;
    } else {
      reason += `Slight ${direction} lean with ${edge.toFixed(1)} unit edge. `;
    }
    
    // Add adjustment notes
    const adjustments = playerProjection.adjustments ?? [];
    const injuryAdjust = adjustments.find(a => a.type === 'injury');
    if (injuryAdjust && injuryAdjust.factor < 1) {
      reason += `Note: ${injuryAdjust.description}. `;
    }
    
    return reason.trim();
  }
  
  /**
   * Get top N events by edge score
   */
  getTopEvents(events: Event[], limit: number = 20): Event[] {
    return events.slice(0, limit);
  }
  
  /**
   * Filter events by sport
   */
  filterBySport(events: Event[], sport: Sport): Event[] {
    return events.filter(e => e.sport === sport);
  }
  
  /**
   * Filter events by league
   */
  filterByLeague(events: Event[], league: League): Event[] {
    return events.filter(e => e.league === league);
  }
  
  /**
   * Filter events by minimum probability
   */
  filterByProbability(events: Event[], minProbability: number): Event[] {
    return events.filter(e => e.probability >= minProbability);
  }
}

export default EdgeDetector;

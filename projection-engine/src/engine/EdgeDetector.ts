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
  // Market thresholds represent the standard deviation of projection uncertainty
  // These are calibrated based on typical variance in player performance
  marketThresholds: {
    POINTS: 4.0,          // NBA: ~4 point std dev (±8 typical range)
    REBOUNDS: 2.0,        // NBA: ~2 rebound std dev
    ASSISTS: 1.5,         // NBA: ~1.5 assist std dev
    THREES: 1.0,          // NBA: ~1 three-pointer std dev
    STOCKS: 1.0,          // Steals + blocks combined
    PRA: 6.0,             // Points + rebounds + assists combined
    PR: 5.0,              // Points + rebounds combined
    PA: 5.0,              // Points + assists combined
    RA: 3.0,              // Rebounds + assists combined
    PASSING_YARDS: 35,    // NFL: ~35 yard std dev for passing
    RUSHING_YARDS: 25,    // NFL: ~25 yard std dev for rushing
    RECEIVING_YARDS: 25,  // NFL: ~25 yard std dev for receiving
    RECEPTIONS: 2.0,      // NFL: ~2 reception std dev
    PASSING_TDS: 0.8,     // NFL: TD variance
    RUSHING_TDS: 0.4,
    RECEIVING_TDS: 0.4,
    INTERCEPTIONS: 0.5,
    GOALS: 0.5,           // Soccer: goal variance
    SOCCER_ASSISTS: 0.5,
    SHOTS: 1.5,
    SHOTS_ON_TARGET: 1.0,
    TACKLES: 1.5,
    KILLS: 2.0,           // Esports
    DEATHS: 2.0,
    ESPORTS_ASSISTS: 2.5,
    CS: 30,               // Creep score
    KDA: 1.5,
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
    
    // Calculate probability with confidence factored in
    const probability = this.calculateProbability(edge, threshold, projection.confidence);
    
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
    
    const probability = this.calculateProbability(edge, threshold, teamProjection.confidence);
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
   * Calculate probability using enhanced normal distribution model
   * 
   * This model incorporates:
   * 1. Base probability from normal distribution (edge vs threshold)
   * 2. Confidence adjustment to account for projection uncertainty
   * 3. Regression to mean for extreme probabilities
   * 
   * The formula uses:
   * - Z-score calculation: z = edge / (threshold * uncertaintyFactor)
   * - Uncertainty factor increases for lower confidence projections
   * - Final probability is regressed toward 0.5 for extreme edges
   */
  private calculateProbability(edge: number, threshold: number, confidence?: number): number {
    // Use confidence to adjust uncertainty - lower confidence = wider distribution
    // Clamp confidence to [0.5, 1.0] range to ensure valid uncertainty factor
    const clampedConfidence = Math.max(0.5, Math.min(1.0, confidence ?? 0.8));
    // Uncertainty factor ranges from 1.5 (low confidence) to 1.0 (high confidence)
    const uncertaintyFactor = 1 + (1 - clampedConfidence);
    
    // Calculate z-score with adjusted threshold for uncertainty
    const adjustedThreshold = threshold * uncertaintyFactor;
    const zScore = edge / adjustedThreshold;
    
    // Calculate base probability using error function
    let probability = 0.5 + 0.5 * this.erf(zScore / Math.sqrt(2));
    
    // Apply mild regression toward 0.5 for extreme probabilities
    // This accounts for model uncertainty and prevents overconfident predictions
    // 
    // regressionStrength (0.15) represents how much extreme probabilities are pulled
    // toward 0.5. This value was chosen to:
    // - Provide meaningful adjustment without over-correcting
    // - Cap effective max probability at ~0.96 instead of 1.0
    // - Cap effective min probability at ~0.04 instead of 0.0
    const regressionStrength = 0.15;
    
    // For probabilities above 0.90, regress toward 0.5
    // Formula: newProb = 0.5 + (prob - 0.5) * (1 - regressionStrength)
    if (probability > 0.90 || probability < 0.10) {
      probability = 0.5 + (probability - 0.5) * (1 - regressionStrength);
    }
    
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

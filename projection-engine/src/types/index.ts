/**
 * SlipSmith Multi-Sport Projection Engine - Core Types
 * 
 * This file contains all the type definitions for the projection engine,
 * designed to be sport-agnostic while supporting specific sport implementations.
 */

// =============================================================================
// SPORT AND LEAGUE TYPES
// =============================================================================

export type Sport = 'basketball' | 'football' | 'soccer' | 'esports';
export type League = 
  | 'NBA' | 'WNBA'           // Basketball
  | 'NFL' | 'NCAA_FB'        // American Football
  | 'EPL' | 'LA_LIGA' | 'BUNDESLIGA' | 'SERIE_A' | 'LIGUE_1' | 'MLS' | 'UEFA_CL' // Soccer
  | 'LOL' | 'CSGO' | 'VALORANT' | 'DOTA2';  // Esports

// =============================================================================
// SCHEDULE AND ROSTER TYPES
// =============================================================================

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  league: League;
  sport: Sport;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: string;
  jerseyNumber?: string;
  status: PlayerStatus;
  injuryStatus?: InjuryStatus;
  injuryNote?: string;
}

export type PlayerStatus = 'active' | 'inactive' | 'traded' | 'released' | 'suspended';
export type InjuryStatus = 'healthy' | 'questionable' | 'doubtful' | 'out' | 'probable' | 'day-to-day';

export interface Game {
  id: string;
  sport: Sport;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  startTime: Date;
  venue?: string;
  status: GameStatus;
}

export type GameStatus = 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';

export interface Schedule {
  date: string; // YYYY-MM-DD
  sport: Sport;
  league: League;
  games: Game[];
}

// =============================================================================
// HISTORICAL STATS (Base)
// =============================================================================

export interface BasePlayerStats {
  playerId: string;
  gameId: string;
  date: string;
  minutesPlayed?: number;
}

// Basketball-specific stats
export interface BasketballPlayerStats extends BasePlayerStats {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threePointersMade: number;
  threePointersAttempted: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
}

// Football-specific stats
export interface FootballPlayerStats extends BasePlayerStats {
  passingYards?: number;
  passingTouchdowns?: number;
  interceptions?: number;
  completions?: number;
  attempts?: number;
  rushingYards?: number;
  rushingTouchdowns?: number;
  carries?: number;
  receivingYards?: number;
  receivingTouchdowns?: number;
  receptions?: number;
  targets?: number;
  sacks?: number;
  tackles?: number;
  fantasyPoints?: number;
}

// Soccer-specific stats
export interface SoccerPlayerStats extends BasePlayerStats {
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  saves?: number; // Goalkeepers
  cleanSheet?: boolean;
  yellowCards: number;
  redCards: number;
}

// Esports-specific stats (League of Legends as example)
export interface EsportsPlayerStats extends BasePlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  cs?: number; // Creep score / minions
  gold?: number;
  damageDealt?: number;
  visionScore?: number;
  objectivesParticipation?: number;
  kda?: number; // Kills-Deaths-Assists ratio
}

export type PlayerStats = 
  | BasketballPlayerStats 
  | FootballPlayerStats 
  | SoccerPlayerStats 
  | EsportsPlayerStats;

// =============================================================================
// CONSENSUS LINES
// =============================================================================

export type MarketType = 
  // Basketball
  | 'POINTS' | 'REBOUNDS' | 'ASSISTS' | 'THREES' | 'STOCKS' | 'PRA' | 'PR' | 'PA' | 'RA'
  // Football
  | 'PASSING_YARDS' | 'RUSHING_YARDS' | 'RECEIVING_YARDS' | 'RECEPTIONS' | 'PASSING_TDS' | 'RUSHING_TDS' | 'RECEIVING_TDS' | 'INTERCEPTIONS'
  // Soccer
  | 'GOALS' | 'SOCCER_ASSISTS' | 'SHOTS' | 'SHOTS_ON_TARGET' | 'TACKLES'
  // Esports
  | 'KILLS' | 'DEATHS' | 'ESPORTS_ASSISTS' | 'CS' | 'KDA'
  // Team markets
  | 'TEAM_TOTAL' | 'GAME_TOTAL' | 'SPREAD' | 'MONEYLINE';

/**
 * Consensus betting line from sportsbooks.
 * 
 * For player props: playerId and playerName are set, teamId/teamName may be set for context.
 * For team props: teamId and teamName are set, playerId/playerName are null.
 */
export interface ConsensusLine {
  id: string;
  gameId: string;
  sport: Sport;
  league: League;
  /** Player ID for player props, null/undefined for team props */
  playerId?: string;
  /** Team ID - set for team props, may be set for player props for context */
  teamId?: string;
  playerName?: string;
  teamName?: string;
  market: MarketType;
  line: number;
  overOdds?: number;
  underOdds?: number;
  timestamp: Date;
  source?: string;
}

// =============================================================================
// PROJECTIONS
// =============================================================================

export interface TeamProjection {
  teamId: string;
  teamName: string;
  gameId: string;
  sport: Sport;
  league: League;
  projectedScore: number;
  projectedStats: Record<string, number>; // Sport-specific team stats
  confidence: number; // 0-1 scale
}

export interface PlayerProjection {
  playerId: string;
  playerName: string;
  teamId: string;
  gameId: string;
  sport: Sport;
  league: League;
  position: string;
  projectedStats: Record<string, number>; // Key-value of stat projections
  confidence: number; // 0-1 scale
  adjustments: ProjectionAdjustment[];
}

export interface ProjectionAdjustment {
  type: 'injury' | 'matchup' | 'pace' | 'rest' | 'home_away' | 'weather' | 'trend';
  factor: number; // Multiplier (1.0 = no change)
  description: string;
}

export interface GameProjection {
  gameId: string;
  sport: Sport;
  league: League;
  date: string;
  homeTeam: TeamProjection;
  awayTeam: TeamProjection;
  players: PlayerProjection[];
  generatedAt: Date;
}

// =============================================================================
// EVENTS (Edge Detection)
// =============================================================================

export type Direction = 'over' | 'under';

export interface Event {
  eventId: string;
  date: string;
  sport: Sport;
  league: League;
  gameId: string;
  teamId?: string;
  teamName?: string;
  playerId?: string;
  playerName?: string;
  market: MarketType;
  line: number;
  direction: Direction;
  modelProjection: number;
  probability: number; // 0-1 scale
  edgeScore: number; // Difference between projection and line
  reasoning: string;
  reliability?: number; // Historical accuracy for this type of bet
  confidence: number; // Overall confidence level
}

// =============================================================================
// EVALUATION AND LEARNING
// =============================================================================

export type EventResult = 'hit' | 'miss' | 'push' | 'void';

export interface EvaluatedEvent extends Event {
  actualValue?: number;
  result: EventResult;
  evaluatedAt: Date;
}

export interface ReliabilityScore {
  id: string;
  sport: Sport;
  league: League;
  playerId?: string;
  teamId?: string;
  market: MarketType;
  totalBets: number;
  hits: number;
  misses: number;
  pushes: number;
  voids: number;
  hitRate: number;
  averageEdge: number;
  lastUpdated: Date;
}

// =============================================================================
// DATA PROVIDER INTERFACE
// =============================================================================

export interface DataProvider {
  sport: Sport;
  supportedLeagues: League[];
  
  // Core data fetching
  getSchedule(league: League, date: string): Promise<Schedule>;
  getTeamRoster(teamId: string): Promise<Player[]>;
  getPlayerStats(playerId: string, numGames?: number): Promise<PlayerStats[]>;
  getTeamStats(teamId: string, numGames?: number): Promise<Record<string, number>>;
  
  // Real-time data
  getInjuryReport(league: League): Promise<Player[]>;
  
  // Box scores
  getGameBoxScore(gameId: string): Promise<{
    home: { team: TeamProjection; players: PlayerStats[] };
    away: { team: TeamProjection; players: PlayerStats[] };
  } | null>;
}

export interface ConsensusLineProvider {
  getLines(sport: Sport, league: League, date: string): Promise<ConsensusLine[]>;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ProjectionResponse {
  success: boolean;
  date: string;
  sport: Sport;
  league: League;
  games: GameProjection[];
  generatedAt: string;
}

export interface EventsResponse {
  success: boolean;
  date: string;
  sport: Sport;
  league: League;
  events: Event[];
  totalEvents: number;
  generatedAt: string;
}

export interface EvaluationResponse {
  success: boolean;
  date: string;
  evaluated: EvaluatedEvent[];
  summary: {
    total: number;
    hits: number;
    misses: number;
    pushes: number;
    voids: number;
    hitRate: number;
  };
}

// =============================================================================
// SLIPSMITH EXPORT FORMAT
// =============================================================================

/**
 * Tier levels for SlipSmith slips
 */
export type SlipTier = 'starter' | 'pro' | 'vip';

/**
 * SlipSmith Event - the official export format for individual events
 * This is the standard format for all SlipSmith event outputs.
 */
export interface SlipEvent {
  event_id: string;
  game_id: string;
  time: string;
  player: string;
  team: string;
  market: string;
  line: number;
  direction: string;
  probability: string; // Must be string with % suffix (e.g., "83%")
  reasoning: string;
}

/**
 * SlipSmith Slip - the official JSON export format for top events
 * 
 * This is the standard format that any consumer (frontends, bots, PDF generator)
 * can safely rely on. The structure and key names must not change.
 */
export interface SlipSmithSlip {
  slip_id: string;
  date: string;
  sport: string;
  tier: SlipTier;
  warning?: string;
  events: SlipEvent[];
}

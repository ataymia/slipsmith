/**
 * SlipSmith Provider Interface Types
 * 
 * These types define the contracts for all data providers used by the projection engine.
 * Implementations can be mock (for testing) or real (for production with external APIs).
 */

// =============================================================================
// SPORT CODES
// =============================================================================

/**
 * Sport codes supported by SlipSmith providers.
 * Use these codes when calling provider methods.
 */
export type SportCode = 
  | 'NBA' 
  | 'WNBA' 
  | 'NFL' 
  | 'NCAA_FB'
  | 'EPL' 
  | 'LA_LIGA' 
  | 'BUNDESLIGA' 
  | 'SERIE_A' 
  | 'LIGUE_1' 
  | 'MLS' 
  | 'UEFA_CL'
  | 'LOL' 
  | 'CSGO' 
  | 'VALORANT' 
  | 'DOTA2';

// =============================================================================
// SCHEDULE PROVIDER TYPES
// =============================================================================

/**
 * Basic game information from schedule provider.
 */
export interface GameInfo {
  gameId: string;
  sport: SportCode;
  homeTeamId: string;
  homeTeamName: string;
  homeTeamAbbreviation: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamAbbreviation: string;
  scheduledTime: Date;
  venue?: string;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
}

// =============================================================================
// ROSTER PROVIDER TYPES
// =============================================================================

/**
 * Player roster entry.
 */
export interface RosterPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  position: string;
  jerseyNumber?: string;
  isActive: boolean;
}

/**
 * Map of gameId -> list of players in that game (both teams combined).
 */
export type RosterMap = Map<string, RosterPlayer[]>;

// =============================================================================
// INJURY PROVIDER TYPES
// =============================================================================

/**
 * Player injury status codes following standard sports conventions.
 * 
 * - OUT: Definitely not playing
 * - Q: Questionable (50/50)
 * - D: Doubtful (unlikely to play)
 * - P: Probable (likely to play)
 * - ACTIVE: Healthy and playing
 */
export type InjuryStatusCode = 'OUT' | 'Q' | 'D' | 'P' | 'ACTIVE';

/**
 * Player injury information.
 */
export interface PlayerInjury {
  playerId: string;
  playerName: string;
  teamId: string;
  status: InjuryStatusCode;
  injuryType?: string;
  notes?: string;
  lastUpdated?: Date;
}

// =============================================================================
// STATS PROVIDER TYPES
// =============================================================================

/**
 * Recent player statistics from lookback games.
 * Keys are stat names (e.g., 'points', 'rebounds', 'assists').
 */
export interface PlayerRecentStats {
  playerId: string;
  playerName: string;
  teamId: string;
  gamesPlayed: number;
  stats: Record<string, number>;  // Stat name -> value (usually average)
  lastGameDate?: string;
}

/**
 * Map of playerId -> recent stats.
 */
export type PlayerRecentStatsMap = Map<string, PlayerRecentStats>;

/**
 * Team historical stats.
 */
export interface TeamStats {
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  stats: Record<string, number>;  // Stat name -> value (usually average)
}

/**
 * Map of teamId -> team stats.
 */
export type TeamStatsMap = Map<string, TeamStats>;

// =============================================================================
// ODDS PROVIDER TYPES
// =============================================================================

/**
 * Prop market types supported by SlipSmith.
 */
export type PropMarketType =
  // Player props - Basketball
  | 'points'
  | 'rebounds'
  | 'assists'
  | 'threes'
  | 'blocks'
  | 'steals'
  | 'turnovers'
  | 'points+rebounds'
  | 'points+assists'
  | 'rebounds+assists'
  | 'points+rebounds+assists'
  // Player props - Football
  | 'passing_yards'
  | 'rushing_yards'
  | 'receiving_yards'
  | 'receptions'
  | 'passing_touchdowns'
  | 'rushing_touchdowns'
  | 'receiving_touchdowns'
  | 'interceptions'
  // Player props - Soccer
  | 'goals'
  | 'soccer_assists'
  | 'shots'
  | 'shots_on_target'
  // Player props - Esports
  | 'kills'
  | 'deaths'
  | 'esports_assists'
  // Team/Game props
  | 'team_total'
  | 'game_total'
  | 'spread'
  | 'moneyline';

/**
 * Direction for over/under markets.
 */
export type MarketDirection = 'over' | 'under';

/**
 * Prop market from odds provider.
 */
export interface PropMarket {
  marketId: string;
  gameId: string;
  sport: SportCode;
  
  /** Player ID for player props, null for team/game props */
  playerId: string | null;
  playerName?: string;
  
  /** Team ID for team props */
  teamId?: string;
  teamName?: string;
  
  marketType: PropMarketType;
  
  /** The consensus betting line */
  line: number;
  
  /** Odds for over (American format, e.g., -110) */
  overOdds?: number;
  
  /** Odds for under (American format, e.g., -110) */
  underOdds?: number;
  
  /** Source of the line (e.g., 'consensus', 'DraftKings', 'FanDuel') */
  source?: string;
  
  /** When this line was last updated */
  timestamp: Date;
}

// =============================================================================
// PROVIDER CONFIGURATION
// =============================================================================

/**
 * Configuration for real data providers.
 * All values come from environment variables.
 */
export interface RealProviderConfig {
  // Stats/Schedule API
  statsApiBaseUrl?: string;
  statsApiKey?: string;
  
  // Odds API
  oddsApiBaseUrl?: string;
  oddsApiKey?: string;
  
  // Injury API
  injuryApiBaseUrl?: string;
  injuryApiKey?: string;
  
  // Legacy keys (backwards compatibility)
  basketballApiKey?: string;
  footballApiKey?: string;
  soccerApiKey?: string;
  esportsApiKey?: string;
}

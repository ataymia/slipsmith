/**
 * SlipSmith Slip Builder
 * 
 * Utility for building standardized SlipSmith JSON output format.
 * This is the official export format that all consumers can rely on.
 */

import {
  Event,
  SlipSmithSlip,
  SlipEvent,
  SlipTier,
  Sport,
  League,
} from '../types';

/**
 * Build a standardized slip_id
 * Format: <SPORT>_<YYYY>_<MM>_<DD>_<TIER>
 * Example: NBA_2025_12_01_VIP
 */
export function buildSlipId(sport: string, date: string, tier: SlipTier): string {
  // Normalize sport to uppercase
  const sportKey = sport.toUpperCase();
  
  // Parse and format date
  const [year, month, day] = date.split('-');
  
  // Build slip_id
  return `${sportKey}_${year}_${month}_${day}_${tier.toUpperCase()}`;
}

/**
 * Convert internal sport/league to display sport string
 */
export function getSportDisplay(sport: Sport, league: League): string {
  // Use league as the primary identifier for major leagues
  const leagueDisplayMap: Record<string, string> = {
    'NBA': 'NBA',
    'WNBA': 'WNBA',
    'NFL': 'NFL',
    'NCAA_FB': 'NCAA_FB',
    'EPL': 'EPL',
    'LA_LIGA': 'LA_LIGA',
    'BUNDESLIGA': 'BUNDESLIGA',
    'SERIE_A': 'SERIE_A',
    'LIGUE_1': 'LIGUE_1',
    'MLS': 'MLS',
    'UEFA_CL': 'UEFA_CL',
    'LOL': 'LOL',
    'CSGO': 'CSGO',
    'VALORANT': 'VALORANT',
    'DOTA2': 'DOTA2',
  };
  
  return leagueDisplayMap[league] ?? sport.toUpperCase();
}

/**
 * Build a standardized event_id
 * Format: <sport>_<teams>_<player>_<market><line>_<direction>_<date>
 * Example: nba_suns_lakers_reaves_ra8_5_over_20251201
 */
export function buildEventId(
  sport: string,
  gameId: string,
  player: string,
  market: string,
  line: number,
  direction: string,
  date: string
): string {
  // Maximum length for player key in event ID
  const MAX_PLAYER_KEY_LENGTH = 20;
  
  // Normalize all components to lowercase and remove special characters
  const sportKey = sport.toLowerCase();
  const gameKey = gameId.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const playerKey = player.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, MAX_PLAYER_KEY_LENGTH);
  const marketKey = market.toLowerCase().replace(/[^a-z0-9]/g, '');
  const lineKey = line.toString().replace('.', '_');
  const directionKey = direction.toLowerCase();
  const dateKey = date.replace(/-/g, '');
  
  return `${sportKey}_${gameKey}_${playerKey}_${marketKey}${lineKey}_${directionKey}_${dateKey}`;
}

/**
 * Format probability as percentage string
 * Input: 0-1 scale number
 * Output: string with % suffix (e.g., "83%")
 */
export function formatProbability(probability: number): string {
  const percentage = Math.round(probability * 100);
  return `${percentage}%`;
}

/**
 * Convert internal Event to SlipEvent format
 */
export function convertToSlipEvent(event: Event, sport: string): SlipEvent {
  // Use player name if available, otherwise team name, otherwise 'unknown'
  const displayName = event.playerName ?? event.teamName ?? 'unknown';
  const teamDisplay = event.teamName ?? '';
  
  return {
    event_id: buildEventId(
      sport,
      event.gameId,
      displayName,
      event.market,
      event.line,
      event.direction,
      event.date
    ),
    game_id: event.gameId,
    time: 'TBD', // Time info not always available
    player: displayName,
    team: teamDisplay,
    market: formatMarketDisplay(event.market),
    line: event.line,
    direction: event.direction,
    probability: formatProbability(event.probability),
    reasoning: event.reasoning,
  };
}

/**
 * Format market type for display
 * Convert internal market types to human-readable format
 */
function formatMarketDisplay(market: string): string {
  const displayMap: Record<string, string> = {
    'POINTS': 'points',
    'REBOUNDS': 'rebounds',
    'ASSISTS': 'assists',
    'THREES': 'threes',
    'STOCKS': 'stocks',
    'PRA': 'points+rebounds+assists',
    'PR': 'points+rebounds',
    'PA': 'points+assists',
    'RA': 'rebounds+assists',
    'PASSING_YARDS': 'passing yards',
    'RUSHING_YARDS': 'rushing yards',
    'RECEIVING_YARDS': 'receiving yards',
    'RECEPTIONS': 'receptions',
    'PASSING_TDS': 'passing touchdowns',
    'RUSHING_TDS': 'rushing touchdowns',
    'RECEIVING_TDS': 'receiving touchdowns',
    'INTERCEPTIONS': 'interceptions',
    'GOALS': 'goals',
    'SOCCER_ASSISTS': 'assists',
    'SHOTS': 'shots',
    'SHOTS_ON_TARGET': 'shots on target',
    'TACKLES': 'tackles',
    'KILLS': 'kills',
    'DEATHS': 'deaths',
    'ESPORTS_ASSISTS': 'assists',
    'CS': 'creep score',
    'KDA': 'kda',
    'TEAM_TOTAL': 'team total',
    'GAME_TOTAL': 'game total',
    'SPREAD': 'spread',
    'MONEYLINE': 'moneyline',
  };
  
  return displayMap[market] ?? market.toLowerCase().replace(/_/g, ' ');
}

/**
 * Build a complete SlipSmith Slip from internal events
 */
export function buildSlipSmithSlip(
  events: Event[],
  date: string,
  sport: Sport,
  league: League,
  tier: SlipTier,
  warning?: string
): SlipSmithSlip {
  const sportDisplay = getSportDisplay(sport, league);
  
  // Sort events by edge score (descending)
  const sortedEvents = [...events].sort((a, b) => b.edgeScore - a.edgeScore);
  
  return {
    slip_id: buildSlipId(sportDisplay, date, tier),
    date,
    sport: sportDisplay,
    tier,
    warning,
    events: sortedEvents.map(e => convertToSlipEvent(e, sportDisplay)),
  };
}

/**
 * Options for building a slip
 */
export interface GetTopEventsOptions {
  date: string;
  sport: Sport;
  league: League;
  tier: SlipTier;
  limit?: number;
  minProbability?: number;
  warning?: string;
}

/**
 * Validate tier value
 */
export function isValidTier(tier: string): tier is SlipTier {
  return ['starter', 'pro', 'vip'].includes(tier.toLowerCase());
}

/**
 * Normalize tier to lowercase SlipTier
 */
export function normalizeTier(tier: string): SlipTier {
  const normalized = tier.toLowerCase();
  if (isValidTier(normalized)) {
    return normalized;
  }
  return 'starter'; // Default tier
}

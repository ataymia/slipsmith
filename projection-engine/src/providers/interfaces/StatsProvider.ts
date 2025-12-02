/**
 * Stats Provider Interface
 * 
 * Provides historical player and team statistics.
 */

import { SportCode, PlayerRecentStatsMap, TeamStatsMap } from './types';

/**
 * StatsProvider fetches historical statistics for players and teams.
 * 
 * Implementations:
 * - MockStatsProvider: Returns generated mock stats for testing
 * - RealStatsProvider: Calls external stats API for real historical data
 */
export interface StatsProvider {
  /**
   * Get recent statistics for specified players.
   * 
   * @param playerIds - Array of player IDs to fetch stats for
   * @param sport - Sport code (e.g., 'NBA', 'NFL')
   * @param lookbackGames - Number of recent games to include (default: 10)
   * @returns Promise resolving to PlayerRecentStatsMap (playerId -> stats)
   */
  getRecentPlayerStats(
    playerIds: string[],
    sport: SportCode,
    lookbackGames?: number
  ): Promise<PlayerRecentStatsMap>;

  /**
   * Get historical statistics for specified teams.
   * 
   * @param teamIds - Array of team IDs to fetch stats for
   * @param sport - Sport code (e.g., 'NBA', 'NFL')
   * @returns Promise resolving to TeamStatsMap (teamId -> stats)
   */
  getHistoricalTeamStats(teamIds: string[], sport: SportCode): Promise<TeamStatsMap>;
}

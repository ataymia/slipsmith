/**
 * Roster Provider Interface
 * 
 * Provides player roster information for games.
 */

import { SportCode, RosterMap } from './types';

/**
 * RosterProvider fetches team rosters for specific games.
 * 
 * Implementations:
 * - MockRosterProvider: Returns generated mock rosters for testing
 * - RealRosterProvider: Calls external stats API for real rosters
 */
export interface RosterProvider {
  /**
   * Get rosters for all players in the specified games.
   * 
   * @param gameIds - Array of game IDs to fetch rosters for
   * @param sport - Sport code (e.g., 'NBA', 'NFL')
   * @returns Promise resolving to RosterMap (gameId -> list of players)
   */
  getRosters(gameIds: string[], sport: SportCode): Promise<RosterMap>;
}

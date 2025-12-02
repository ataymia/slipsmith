/**
 * Injury Provider Interface
 * 
 * Provides injury status information for players.
 */

import { SportCode, PlayerInjury } from './types';

/**
 * InjuryProvider fetches current injury reports for players.
 * 
 * Implementations:
 * - MockInjuryProvider: Returns generated mock injury data for testing
 * - RealInjuryProvider: Calls external injury API for real data
 */
export interface InjuryProvider {
  /**
   * Get injury report for all players in a sport for a given date.
   * 
   * @param date - Date in YYYY-MM-DD format
   * @param sport - Sport code (e.g., 'NBA', 'NFL')
   * @returns Promise resolving to array of player injury information
   */
  getInjuryReport(date: string, sport: SportCode): Promise<PlayerInjury[]>;
}

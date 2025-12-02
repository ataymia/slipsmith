/**
 * Odds Provider Interface
 * 
 * Provides consensus betting lines and prop markets.
 */

import { SportCode, PropMarket } from './types';

/**
 * OddsProvider fetches consensus betting lines and prop markets.
 * 
 * Implementations:
 * - MockOddsProvider: Returns generated mock lines for testing
 * - RealOddsProvider: Calls external odds API for real market data
 */
export interface OddsProvider {
  /**
   * Get consensus prop markets for a given date and sport.
   * 
   * @param date - Date in YYYY-MM-DD format
   * @param sport - Sport code (e.g., 'NBA', 'NFL')
   * @returns Promise resolving to array of prop markets with lines
   */
  getConsensusProps(date: string, sport: SportCode): Promise<PropMarket[]>;
}

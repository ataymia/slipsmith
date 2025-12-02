/**
 * Schedule Provider Interface
 * 
 * Provides game schedule information for a given date and sport.
 */

import { SportCode, GameInfo } from './types';

/**
 * ScheduleProvider fetches game schedule data from external sources.
 * 
 * Implementations:
 * - MockScheduleProvider: Returns generated mock data for testing
 * - RealScheduleProvider: Calls external stats API for real schedules
 */
export interface ScheduleProvider {
  /**
   * Get all games scheduled for a specific date and sport.
   * 
   * @param date - Date in YYYY-MM-DD format
   * @param sport - Sport code (e.g., 'NBA', 'NFL')
   * @returns Promise resolving to array of game information
   */
  getGames(date: string, sport: SportCode): Promise<GameInfo[]>;
}

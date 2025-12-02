/**
 * Sports Handler
 * 
 * Gets supported sports and leagues.
 * Works across Express and Cloudflare Workers.
 */

import type { Sport, League } from '../../types';
import { ProviderFactory, ProviderConfig } from '../../providers';
import { 
  EnvBindings, 
  getProviderConfig,
} from './types';

export interface SportsResult {
  success: boolean;
  sports?: Record<Sport, League[]>;
  error?: string;
  status: number;
}

export interface ScheduleResult {
  success: boolean;
  schedule?: any;
  error?: string;
  status: number;
}

/**
 * Get supported sports and leagues
 */
export async function handleSports(
  env: EnvBindings
): Promise<SportsResult> {
  try {
    const config: ProviderConfig = getProviderConfig(env);
    const providerFactory = new ProviderFactory(config);
    
    const sports = providerFactory.getSupportedSports();
    const result: Record<Sport, League[]> = {} as any;
    
    for (const sport of sports) {
      result[sport] = providerFactory.getSupportedLeagues(sport);
    }
    
    return {
      success: true,
      sports: result,
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get sports',
      status: 400,
    };
  }
}

/**
 * Get schedule for a league and date
 */
export async function handleSchedule(
  league: League,
  date: string,
  env: EnvBindings
): Promise<ScheduleResult> {
  try {
    const config: ProviderConfig = getProviderConfig(env);
    const providerFactory = new ProviderFactory(config);
    const provider = providerFactory.getProviderForLeague(league);
    
    const schedule = await provider.getSchedule(league, date);
    
    return {
      success: true,
      schedule,
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get schedule',
      status: 400,
    };
  }
}

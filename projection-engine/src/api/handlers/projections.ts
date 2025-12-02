/**
 * Projections Handler
 * 
 * Generates projections for games. Works across Express and Cloudflare Workers.
 */

import type { 
  League, 
  Sport, 
  GameProjection, 
  ProjectionResponse 
} from '../../types';
import { ProviderFactory, ProviderConfig } from '../../providers';
import { ProjectionEngine } from '../../engine';
import { 
  EnvBindings, 
  ProjectionsParams, 
  getProviderConfig,
  isMockMode,
} from './types';

export interface ProjectionsResult {
  success: boolean;
  response?: ProjectionResponse;
  error?: string;
  status: number;
}

/**
 * Generate projections for a league and date
 */
export async function handleProjections(
  params: ProjectionsParams,
  env: EnvBindings
): Promise<ProjectionsResult> {
  try {
    const { league, date } = params;
    
    // Create provider factory with config from environment
    const config: ProviderConfig = getProviderConfig(env);
    const providerFactory = new ProviderFactory(config);
    const projectionEngine = new ProjectionEngine(providerFactory);
    
    // Generate projections
    const projections = await projectionEngine.generateProjections(league, date);
    
    // Get sport for this league
    const sport = providerFactory.getSportForLeague(league);
    
    // Build warning if in mock mode
    let warning: string | undefined;
    if (isMockMode(env)) {
      warning = 'Using mock data for demonstration. Set USE_MOCK_DATA=false and configure API keys for live data.';
    }
    
    const response: ProjectionResponse = {
      success: true,
      date,
      sport,
      league,
      games: projections,
      generatedAt: new Date().toISOString(),
    };
    
    return {
      success: true,
      response,
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to generate projections',
      status: 400,
    };
  }
}

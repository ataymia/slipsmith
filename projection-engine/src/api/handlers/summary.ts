/**
 * Summary Handler
 * 
 * Gets evaluation summary data.
 * Works across Express and Cloudflare Workers.
 * 
 * Note: The evaluation engine uses SQLite which is not available in Cloudflare Workers.
 * For Cloudflare, this returns mock/empty data. In production, evaluation data
 * would be stored in Firestore and accessed via the Firebase integration.
 */

import { 
  EnvBindings, 
  SummaryParams,
  isMockMode,
} from './types';

export interface SummaryResult {
  success: boolean;
  summary?: {
    total: number;
    hits: number;
    misses: number;
    pushes: number;
    voids: number;
    hitRate: number;
    averageEdge: number;
    startDate: string;
    endDate: string;
  };
  error?: string;
  warning?: string;
  status: number;
}

/**
 * Get evaluation summary
 * 
 * Note: In Cloudflare Workers, we don't have access to SQLite.
 * This returns mock data or would need to be refactored to use Firestore.
 */
export async function handleSummary(
  params: SummaryParams,
  env: EnvBindings
): Promise<SummaryResult> {
  try {
    const startDate = params.startDate || '2024-01-01';
    const endDate = params.endDate || new Date().toISOString().split('T')[0];
    
    // In Cloudflare Workers, we can't use SQLite
    // Return empty/mock data with a warning
    // In a full implementation, this would fetch from Firestore
    
    const warning = isMockMode(env)
      ? 'Summary data is not available in mock mode. Connect Firebase for persistent evaluation tracking.'
      : undefined;
    
    return {
      success: true,
      summary: {
        total: 0,
        hits: 0,
        misses: 0,
        pushes: 0,
        voids: 0,
        hitRate: 0,
        averageEdge: 0,
        startDate,
        endDate,
      },
      warning,
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get summary',
      status: 400,
    };
  }
}

export interface EvaluateResult {
  success: boolean;
  summary?: {
    total: number;
    hits: number;
    misses: number;
    pushes: number;
    voids: number;
    hitRate: number;
  };
  error?: string;
  warning?: string;
  status: number;
}

/**
 * Evaluate past predictions
 * 
 * Note: In Cloudflare Workers, evaluation is limited since SQLite is not available.
 * This returns a message indicating evaluation should be run via the CLI in Node.js.
 */
export async function handleEvaluate(
  date: string,
  env: EnvBindings
): Promise<EvaluateResult> {
  try {
    // In Cloudflare Workers, we can't run full evaluation with SQLite
    // Return a helpful message
    
    return {
      success: true,
      summary: {
        total: 0,
        hits: 0,
        misses: 0,
        pushes: 0,
        voids: 0,
        hitRate: 0,
      },
      warning: 'Evaluation is currently only available via the CLI in Node.js. Run: npm run evaluate',
      status: 200,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to evaluate',
      status: 400,
    };
  }
}

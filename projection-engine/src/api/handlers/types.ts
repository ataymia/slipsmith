/**
 * API Handler Types
 * 
 * Common types for API handlers that work across Express and Cloudflare Workers.
 */

import type { Sport, League, SlipTier } from '../../types';

/**
 * Environment bindings configuration
 * These are read from Cloudflare bindings (env.*) or process.env for Node.js
 */
export interface EnvBindings {
  // Server config
  PORT?: string;
  DB_PATH?: string;
  
  // Mode
  USE_MOCK_DATA?: string;
  
  // Firebase / Firestore
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  
  // Sports APIs
  BASKETBALL_API_KEY?: string;
  FOOTBALL_API_KEY?: string;
  SOCCER_API_KEY?: string;
  ESPORTS_API_KEY?: string;
  
  // Lines / Odds APIs
  ODDS_API_KEY?: string;
  LINES_API_KEY?: string;
  
  // Optional integrations
  OPENAI_API_KEY?: string;
  DISCORD_WEBHOOK_URL?: string;
  SLACK_WEBHOOK_URL?: string;
}

/**
 * Request context for handlers
 */
export interface HandlerContext {
  env: EnvBindings;
}

/**
 * API Response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
}

/**
 * Projections request params
 */
export interface ProjectionsParams {
  league: League;
  date: string;
}

/**
 * Events request params
 */
export interface EventsParams {
  league: League;
  date: string;
  limit?: number;
  minProbability?: number;
}

/**
 * Top events request params
 */
export interface TopEventsParams {
  date: string;
  sport: string;
  tier?: SlipTier;
  limit?: number;
  minProbability?: number;
}

/**
 * Evaluate request params
 */
export interface EvaluateParams {
  date: string;
}

/**
 * Summary request params
 */
export interface SummaryParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Check if mock mode is enabled
 * 
 * Mock mode is DISABLED by default for production use.
 * Set USE_MOCK_DATA=true to enable mock data for testing/development.
 */
export function isMockMode(env: EnvBindings): boolean {
  const useMockData = env.USE_MOCK_DATA;
  // Default to false (real APIs) if USE_MOCK_DATA is not set
  if (useMockData === undefined || useMockData === null || useMockData === '') {
    return false;
  }
  // Only return true if explicitly set to 'true'
  return useMockData.toLowerCase() === 'true';
}

/**
 * Check if required keys are present for a specific provider
 */
export function hasRequiredKeys(env: EnvBindings, provider: 'firebase' | 'sports' | 'lines'): boolean {
  switch (provider) {
    case 'firebase':
      return !!(env.FIREBASE_PROJECT_ID);
    case 'sports':
      // At least one sports API key should be present
      return !!(
        env.BASKETBALL_API_KEY ||
        env.FOOTBALL_API_KEY ||
        env.SOCCER_API_KEY ||
        env.ESPORTS_API_KEY
      );
    case 'lines':
      return !!(env.ODDS_API_KEY || env.LINES_API_KEY);
    default:
      return false;
  }
}

/**
 * Get missing keys message for user-friendly error
 */
export function getMissingKeysMessage(env: EnvBindings): string[] {
  const missing: string[] = [];
  
  if (!env.FIREBASE_PROJECT_ID) {
    missing.push('FIREBASE_PROJECT_ID — required for Firestore storage');
  }
  
  if (!env.ODDS_API_KEY && !env.LINES_API_KEY) {
    missing.push('ODDS_API_KEY or LINES_API_KEY — required for live odds/lines data');
  }
  
  return missing;
}

/**
 * Provider configuration derived from env bindings
 */
export interface ProviderConfigFromEnv {
  basketballApiKey?: string;
  footballApiKey?: string;
  soccerApiKey?: string;
  esportsApiKey?: string;
  useMockData: boolean;
}

/**
 * Create provider config from environment bindings
 */
export function getProviderConfig(env: EnvBindings): ProviderConfigFromEnv {
  return {
    basketballApiKey: env.BASKETBALL_API_KEY,
    footballApiKey: env.FOOTBALL_API_KEY,
    soccerApiKey: env.SOCCER_API_KEY,
    esportsApiKey: env.ESPORTS_API_KEY,
    useMockData: isMockMode(env),
  };
}

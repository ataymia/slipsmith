/**
 * Data Providers Index
 * 
 * Central export point for all data providers.
 * 
 * This module exports two generations of provider architecture:
 * 
 * 1. Legacy Providers (ProviderFactory, BaseDataProvider, etc.)
 *    - Sport-specific providers like BasketballProvider, FootballProvider
 *    - Still used by existing ProjectionEngine and EvaluationEngine
 * 
 * 2. New SlipSmith Providers (SlipSmithProviderFactory)
 *    - Interface-based providers (ScheduleProvider, OddsProvider, etc.)
 *    - Mock and Real implementations
 *    - Ready for real API integration
 */

// =============================================================================
// NEW SLIPSMITH PROVIDER INTERFACES AND IMPLEMENTATIONS
// =============================================================================

// Provider interfaces and types
export * from './interfaces';

// Mock provider implementations
export * from './mock';

// Real provider stub implementations
export * from './real';

// New provider factory
export { SlipSmithProviderFactory } from './SlipSmithProviderFactory';
export type { SlipSmithProviderConfig } from './SlipSmithProviderFactory';

// =============================================================================
// LEGACY PROVIDERS (kept for backward compatibility)
// =============================================================================

export { BaseDataProvider, MockDataProvider } from './BaseProvider';
export { BasketballProvider } from './BasketballProvider';
export { FootballProvider } from './FootballProvider';
export { SoccerProvider } from './SoccerProvider';
export { EsportsProvider } from './EsportsProvider';

import { Sport, League, DataProvider } from '../types';
import { MockDataProvider } from './BaseProvider';
import { BasketballProvider } from './BasketballProvider';
import { FootballProvider } from './FootballProvider';
import { SoccerProvider } from './SoccerProvider';
import { EsportsProvider } from './EsportsProvider';

/**
 * Configuration for API keys
 */
export interface ProviderConfig {
  basketballApiKey?: string;  // balldontlie.io key
  footballApiKey?: string;    // Not required for ESPN
  soccerApiKey?: string;      // API-Football key (optional)
  esportsApiKey?: string;     // Pandascore key
  useMockData?: boolean;      // Force use of mock data
}

/**
 * Provider Factory (Legacy)
 * 
 * Creates the appropriate data provider for a given sport.
 * 
 * Note: For new development, consider using SlipSmithProviderFactory instead,
 * which provides more granular control over individual data sources.
 */
export class ProviderFactory {
  private config: ProviderConfig;
  private providers: Map<Sport, DataProvider> = new Map();
  
  constructor(config: ProviderConfig = {}) {
    this.config = config;
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    if (this.config.useMockData) {
      // Use mock providers for all sports
      this.providers.set('basketball', new MockDataProvider('basketball', ['NBA', 'WNBA']));
      this.providers.set('football', new MockDataProvider('football', ['NFL', 'NCAA_FB']));
      this.providers.set('soccer', new MockDataProvider('soccer', ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1', 'MLS', 'UEFA_CL']));
      this.providers.set('esports', new MockDataProvider('esports', ['LOL', 'CSGO', 'VALORANT', 'DOTA2']));
    } else {
      // Use real providers
      this.providers.set('basketball', new BasketballProvider(this.config.basketballApiKey));
      this.providers.set('football', new FootballProvider(this.config.footballApiKey));
      this.providers.set('soccer', new SoccerProvider(this.config.soccerApiKey));
      this.providers.set('esports', new EsportsProvider(this.config.esportsApiKey));
    }
  }
  
  /**
   * Get provider for a sport
   */
  getProvider(sport: Sport): DataProvider {
    const provider = this.providers.get(sport);
    if (!provider) {
      throw new Error(`No provider found for sport: ${sport}`);
    }
    return provider;
  }
  
  /**
   * Get provider for a specific league
   */
  getProviderForLeague(league: League): DataProvider {
    const sport = this.getSportForLeague(league);
    return this.getProvider(sport);
  }
  
  /**
   * Determine sport from league
   */
  getSportForLeague(league: League): Sport {
    const leagueSportMap: Record<League, Sport> = {
      'NBA': 'basketball',
      'WNBA': 'basketball',
      'NFL': 'football',
      'NCAA_FB': 'football',
      'EPL': 'soccer',
      'LA_LIGA': 'soccer',
      'BUNDESLIGA': 'soccer',
      'SERIE_A': 'soccer',
      'LIGUE_1': 'soccer',
      'MLS': 'soccer',
      'UEFA_CL': 'soccer',
      'LOL': 'esports',
      'CSGO': 'esports',
      'VALORANT': 'esports',
      'DOTA2': 'esports',
    };
    
    const sport = leagueSportMap[league];
    if (!sport) {
      throw new Error(`Unknown league: ${league}`);
    }
    return sport;
  }
  
  /**
   * Get all supported leagues for a sport
   */
  getSupportedLeagues(sport: Sport): League[] {
    const provider = this.getProvider(sport);
    return provider.supportedLeagues;
  }
  
  /**
   * Get all supported sports
   */
  getSupportedSports(): Sport[] {
    return Array.from(this.providers.keys());
  }
}

export default ProviderFactory;

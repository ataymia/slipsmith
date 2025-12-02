/**
 * SlipSmith Provider Factory
 * 
 * Central factory for creating data provider instances based on configuration.
 * Manages the selection between mock providers (for testing/development) 
 * and real providers (for production with external APIs).
 * 
 * =============================================================================
 * CONFIGURATION:
 * =============================================================================
 * 
 * The factory reads the following environment variables:
 * 
 * USE_MOCK_DATA - Set to 'true' to use mock providers (default: true)
 *   When true: Returns Mock*Provider instances
 *   When false: Returns Real*Provider instances
 * 
 * For real providers, the following are required:
 * - STATS_API_BASE_URL, STATS_API_KEY - For schedule, roster, and stats
 * - ODDS_API_BASE_URL, ODDS_API_KEY - For betting lines and props
 * - INJURY_API_BASE_URL, INJURY_API_KEY - For injury reports (optional, falls back to stats API)
 * 
 * =============================================================================
 */

import {
  ScheduleProvider,
  RosterProvider,
  InjuryProvider,
  StatsProvider,
  OddsProvider,
  RealProviderConfig,
} from './interfaces';

import {
  MockScheduleProvider,
  MockRosterProvider,
  MockInjuryProvider,
  MockStatsProvider,
  MockOddsProvider,
} from './mock';

import {
  RealScheduleProvider,
  RealRosterProvider,
  RealInjuryProvider,
  RealStatsProvider,
  RealOddsProvider,
} from './real';

/**
 * Configuration options for the SlipSmithProviderFactory.
 */
export interface SlipSmithProviderConfig {
  /** Use mock data instead of real APIs (default: true) */
  useMockData?: boolean;
  
  /** Configuration for real providers */
  realProviderConfig?: RealProviderConfig;
}

/**
 * SlipSmithProviderFactory creates and manages data provider instances.
 * 
 * Usage:
 * ```typescript
 * const factory = new SlipSmithProviderFactory({ useMockData: false });
 * const schedule = await factory.getScheduleProvider().getGames('2025-12-01', 'NBA');
 * ```
 */
export class SlipSmithProviderFactory {
  private useMockData: boolean;
  private realConfig: RealProviderConfig;
  
  // Provider instances (lazy-initialized)
  private scheduleProvider?: ScheduleProvider;
  private rosterProvider?: RosterProvider;
  private injuryProvider?: InjuryProvider;
  private statsProvider?: StatsProvider;
  private oddsProvider?: OddsProvider;
  
  constructor(config: SlipSmithProviderConfig = {}) {
    this.useMockData = config.useMockData ?? true;
    
    // Read configuration from environment if not provided
    this.realConfig = config.realProviderConfig ?? {
      statsApiBaseUrl: process.env.STATS_API_BASE_URL,
      statsApiKey: process.env.STATS_API_KEY,
      oddsApiBaseUrl: process.env.ODDS_API_BASE_URL,
      oddsApiKey: process.env.ODDS_API_KEY,
      injuryApiBaseUrl: process.env.INJURY_API_BASE_URL,
      injuryApiKey: process.env.INJURY_API_KEY,
      // Legacy keys for backward compatibility
      basketballApiKey: process.env.BASKETBALL_API_KEY,
      footballApiKey: process.env.FOOTBALL_API_KEY,
      soccerApiKey: process.env.SOCCER_API_KEY,
      esportsApiKey: process.env.ESPORTS_API_KEY,
    };
    
    if (!this.useMockData) {
      this.logProviderStatus();
    }
  }
  
  /**
   * Log the status of configured providers.
   */
  private logProviderStatus(): void {
    // Real providers now use ESPN (free, no key required) for most data
    console.log('SlipSmith Provider Status:');
    console.log('  Schedule API: ✓ Using ESPN (free)');
    console.log('  Roster API: ✓ Using ESPN (free)');
    console.log('  Injury API: ✓ Using ESPN (free)');
    console.log('  Stats API: ✓ Using ESPN + balldontlie (free)');
    
    const oddsConfigured = !!(this.realConfig.oddsApiBaseUrl && this.realConfig.oddsApiKey);
    console.log(`  Odds API: ${oddsConfigured ? '✓ Configured' : '⚠ Not configured (using mock)'}`);
    
    if (!oddsConfigured) {
      console.warn(
        '\nNote: Odds provider is not configured. ' +
        'For production, set ODDS_API_BASE_URL and ODDS_API_KEY. ' +
        'See docs/APIS_AND_KEYS.md for details.'
      );
    }
  }
  
  /**
   * Get the Schedule Provider.
   * Real provider uses ESPN (free, no key required).
   */
  getScheduleProvider(): ScheduleProvider {
    if (!this.scheduleProvider) {
      if (this.useMockData) {
        this.scheduleProvider = new MockScheduleProvider();
      } else {
        // Real provider uses ESPN - no API key needed
        this.scheduleProvider = new RealScheduleProvider(this.realConfig);
      }
    }
    return this.scheduleProvider;
  }
  
  /**
   * Get the Roster Provider.
   * Real provider uses ESPN (free, no key required).
   */
  getRosterProvider(): RosterProvider {
    if (!this.rosterProvider) {
      if (this.useMockData) {
        this.rosterProvider = new MockRosterProvider();
      } else {
        // Real provider uses ESPN - no API key needed
        this.rosterProvider = new RealRosterProvider(this.realConfig);
      }
    }
    return this.rosterProvider;
  }
  
  /**
   * Get the Injury Provider.
   * Real provider uses ESPN (free, no key required).
   */
  getInjuryProvider(): InjuryProvider {
    if (!this.injuryProvider) {
      if (this.useMockData) {
        this.injuryProvider = new MockInjuryProvider();
      } else {
        // Real provider uses ESPN - no API key needed
        this.injuryProvider = new RealInjuryProvider(this.realConfig);
      }
    }
    return this.injuryProvider;
  }
  
  /**
   * Get the Stats Provider.
   * Real provider uses ESPN and balldontlie (free, optional key for higher rate limits).
   */
  getStatsProvider(): StatsProvider {
    if (!this.statsProvider) {
      if (this.useMockData) {
        this.statsProvider = new MockStatsProvider();
      } else {
        // Real provider uses ESPN/balldontlie - no API key required
        this.statsProvider = new RealStatsProvider(this.realConfig);
      }
    }
    return this.statsProvider;
  }
  
  /**
   * Get the Odds Provider.
   * Falls back to mock if real provider is not configured.
   */
  getOddsProvider(): OddsProvider {
    if (!this.oddsProvider) {
      if (this.useMockData) {
        this.oddsProvider = new MockOddsProvider();
      } else if (this.realConfig.oddsApiBaseUrl && this.realConfig.oddsApiKey) {
        this.oddsProvider = new RealOddsProvider(this.realConfig);
      } else {
        console.warn('Odds provider not configured, falling back to mock');
        this.oddsProvider = new MockOddsProvider();
      }
    }
    return this.oddsProvider;
  }
  
  /**
   * Check if using mock data.
   */
  isUsingMockData(): boolean {
    return this.useMockData;
  }
  
  /**
   * Get all providers at once.
   */
  getAllProviders(): {
    schedule: ScheduleProvider;
    roster: RosterProvider;
    injury: InjuryProvider;
    stats: StatsProvider;
    odds: OddsProvider;
  } {
    return {
      schedule: this.getScheduleProvider(),
      roster: this.getRosterProvider(),
      injury: this.getInjuryProvider(),
      stats: this.getStatsProvider(),
      odds: this.getOddsProvider(),
    };
  }
}

export default SlipSmithProviderFactory;

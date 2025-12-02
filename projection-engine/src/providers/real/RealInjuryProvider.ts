/**
 * Real Injury Provider
 * 
 * Uses ESPN API (free, no key required) for injury reports.
 * This is a production-ready implementation using publicly available ESPN endpoints.
 * 
 * =============================================================================
 * ESPN API ENDPOINTS:
 * =============================================================================
 * 
 * Basketball (NBA/WNBA):
 *   https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/injuries
 * 
 * Football (NFL/NCAA):
 *   https://site.api.espn.com/apis/site/v2/sports/football/{league}/injuries
 * 
 * No API key required - these are public endpoints.
 * 
 * =============================================================================
 * SLIPSMITH INJURY RULES:
 * =============================================================================
 * 
 * The injury data is used to apply SlipSmith's core rules:
 * - DNP Rule: Never project players with status "OUT"
 * - Usage Spikes: Identify players who may see increased usage when stars are OUT
 * - Confidence Penalty: Apply penalties for Questionable (Q) and Doubtful (D) players
 * 
 * =============================================================================
 */

import axios from 'axios';
import {
  InjuryProvider,
  SportCode,
  PlayerInjury,
  InjuryStatusCode,
  RealProviderConfig,
} from '../interfaces';

// ESPN league identifiers
const SPORT_ESPN_MAP: Record<SportCode, { sport: string; league: string } | null> = {
  'NBA': { sport: 'basketball', league: 'nba' },
  'WNBA': { sport: 'basketball', league: 'wnba' },
  'NFL': { sport: 'football', league: 'nfl' },
  'NCAA_FB': { sport: 'football', league: 'college-football' },
  'EPL': { sport: 'soccer', league: 'eng.1' },
  'LA_LIGA': { sport: 'soccer', league: 'esp.1' },
  'BUNDESLIGA': { sport: 'soccer', league: 'ger.1' },
  'SERIE_A': { sport: 'soccer', league: 'ita.1' },
  'LIGUE_1': { sport: 'soccer', league: 'fra.1' },
  'MLS': { sport: 'soccer', league: 'usa.1' },
  'UEFA_CL': { sport: 'soccer', league: 'uefa.champions' },
  // Esports don't have traditional injuries
  'LOL': null,
  'CSGO': null,
  'VALORANT': null,
  'DOTA2': null,
};

/**
 * Real implementation of InjuryProvider using ESPN API.
 * No API key required - uses free public endpoints.
 */
export class RealInjuryProvider implements InjuryProvider {
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports';
  
  constructor(_config?: RealProviderConfig) {
    // ESPN doesn't require API keys
  }
  
  /**
   * Get injury report from ESPN API.
   */
  async getInjuryReport(date: string, sport: SportCode): Promise<PlayerInjury[]> {
    const mapping = SPORT_ESPN_MAP[sport];
    
    if (!mapping) {
      // Esports and some sports don't have ESPN injury endpoints
      return [];
    }
    
    try {
      const url = `${this.espnBaseUrl}/${mapping.sport}/${mapping.league}/injuries`;
      
      const response = await axios.get(url, {
        timeout: 10000,
      });
      
      const injuries: PlayerInjury[] = [];
      
      for (const team of (response.data.injuries ?? [])) {
        const teamId = team.team?.id ?? '';
        
        for (const item of (team.injuries ?? [])) {
          const athlete = item.athlete as Record<string, unknown>;
          
          injuries.push({
            playerId: String(athlete?.id ?? ''),
            playerName: (athlete?.displayName as string) ?? '',
            teamId: String(teamId),
            status: this.mapInjuryStatus(item.status as string),
            injuryType: (item.details?.type as string) ?? (item.type as string) ?? undefined,
            notes: (item.details?.detail as string) ?? (item.longComment as string) ?? undefined,
            lastUpdated: new Date(),
          });
        }
      }
      
      return injuries;
    } catch (error) {
      // Many ESPN injury endpoints may 404 - this is expected for some leagues
      console.warn(`Could not fetch ${sport} injuries from ESPN (may not be available)`);
      return [];
    }
  }
  
  /**
   * Map ESPN injury status to SlipSmith InjuryStatusCode.
   */
  private mapInjuryStatus(status: string | undefined): InjuryStatusCode {
    const statusLower = (status ?? '').toLowerCase();
    
    if (statusLower.includes('out')) return 'OUT';
    if (statusLower.includes('doubtful')) return 'D';
    if (statusLower.includes('questionable')) return 'Q';
    if (statusLower.includes('probable')) return 'P';
    if (statusLower.includes('day-to-day') || statusLower.includes('dtd')) return 'Q';
    
    return 'ACTIVE';
  }
}

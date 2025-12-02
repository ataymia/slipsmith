/**
 * Real Schedule Provider
 * 
 * Uses ESPN API (free, no key required) for game schedules.
 * This is a production-ready implementation using publicly available ESPN endpoints.
 * 
 * =============================================================================
 * ESPN API ENDPOINTS:
 * =============================================================================
 * 
 * Basketball (NBA/WNBA):
 *   https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/scoreboard
 * 
 * Football (NFL/NCAA):
 *   https://site.api.espn.com/apis/site/v2/sports/football/{league}/scoreboard
 * 
 * Soccer:
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard
 * 
 * No API key required - these are public endpoints.
 * 
 * =============================================================================
 */

import axios from 'axios';
import {
  ScheduleProvider,
  SportCode,
  GameInfo,
  RealProviderConfig,
} from '../interfaces';

// ESPN league identifiers
const SPORT_ESPN_MAP: Record<SportCode, { sport: string; league: string }> = {
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
  'LOL': { sport: 'esports', league: 'lol' },
  'CSGO': { sport: 'esports', league: 'csgo' },
  'VALORANT': { sport: 'esports', league: 'valorant' },
  'DOTA2': { sport: 'esports', league: 'dota2' },
};

/**
 * Real implementation of ScheduleProvider using ESPN API.
 * No API key required - uses free public endpoints.
 */
export class RealScheduleProvider implements ScheduleProvider {
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports';
  
  constructor(_config?: RealProviderConfig) {
    // ESPN doesn't require API keys
  }
  
  /**
   * Get games from ESPN API.
   */
  async getGames(date: string, sport: SportCode): Promise<GameInfo[]> {
    const mapping = SPORT_ESPN_MAP[sport];
    
    if (!mapping) {
      console.warn(`No ESPN mapping for sport: ${sport}`);
      return [];
    }
    
    // ESPN doesn't have esports - esports data requires PandaScore or similar API
    if (mapping.sport === 'esports') {
      console.warn(`Esports schedule requires a dedicated esports API like PandaScore`);
      return [];
    }
    
    try {
      const formattedDate = date.replace(/-/g, '');
      const url = `${this.espnBaseUrl}/${mapping.sport}/${mapping.league}/scoreboard`;
      
      const response = await axios.get(url, {
        params: { dates: formattedDate },
        timeout: 10000,
      });
      
      const games: GameInfo[] = [];
      
      for (const event of (response.data.events ?? [])) {
        const competition = (event.competitions as Record<string, unknown>[])?.[0];
        const competitors = (competition?.competitors as Record<string, unknown>[]) ?? [];
        
        const homeTeamData = competitors.find((c) => c.homeAway === 'home') as Record<string, unknown> | undefined;
        const awayTeamData = competitors.find((c) => c.homeAway === 'away') as Record<string, unknown> | undefined;
        
        if (!homeTeamData || !awayTeamData) continue;
        
        const homeTeam = homeTeamData.team as Record<string, unknown>;
        const awayTeam = awayTeamData.team as Record<string, unknown>;
        
        games.push({
          gameId: String(event.id),
          sport,
          homeTeamId: String(homeTeamData.id ?? homeTeam?.id ?? ''),
          homeTeamName: (homeTeam?.displayName as string) ?? '',
          homeTeamAbbreviation: (homeTeam?.abbreviation as string) ?? '',
          awayTeamId: String(awayTeamData.id ?? awayTeam?.id ?? ''),
          awayTeamName: (awayTeam?.displayName as string) ?? '',
          awayTeamAbbreviation: (awayTeam?.abbreviation as string) ?? '',
          scheduledTime: new Date(event.date as string),
          venue: ((competition?.venue as Record<string, unknown>)?.fullName as string) ?? undefined,
          status: this.mapGameStatus(event.status as Record<string, unknown>),
        });
      }
      
      return games;
    } catch (error) {
      console.error(`Error fetching ${sport} schedule from ESPN:`, error);
      return [];
    }
  }
  
  /**
   * Map ESPN status to GameInfo status.
   */
  private mapGameStatus(status: Record<string, unknown> | undefined): GameInfo['status'] {
    const type = (status?.type as Record<string, unknown>)?.name as string;
    switch (type) {
      case 'STATUS_SCHEDULED': return 'scheduled';
      case 'STATUS_IN_PROGRESS':
      case 'STATUS_FIRST_HALF':
      case 'STATUS_SECOND_HALF':
      case 'STATUS_HALFTIME':
        return 'in_progress';
      case 'STATUS_FINAL': return 'final';
      case 'STATUS_POSTPONED': return 'postponed';
      case 'STATUS_CANCELED': return 'cancelled';
      default: return 'scheduled';
    }
  }
}

/**
 * Real Roster Provider
 * 
 * Uses ESPN API (free, no key required) for team rosters.
 * This is a production-ready implementation using publicly available ESPN endpoints.
 * 
 * =============================================================================
 * ESPN API ENDPOINTS:
 * =============================================================================
 * 
 * Basketball (NBA/WNBA):
 *   https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/teams/{teamId}/roster
 * 
 * Football (NFL/NCAA):
 *   https://site.api.espn.com/apis/site/v2/sports/football/{league}/teams/{teamId}/roster
 * 
 * Soccer:
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams/{teamId}/roster
 * 
 * No API key required - these are public endpoints.
 * 
 * =============================================================================
 */

import axios from 'axios';
import {
  RosterProvider,
  SportCode,
  RosterMap,
  RosterPlayer,
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
  // Esports use different API (PandaScore)
  'LOL': null,
  'CSGO': null,
  'VALORANT': null,
  'DOTA2': null,
};

/**
 * Real implementation of RosterProvider using ESPN API.
 * No API key required - uses free public endpoints.
 */
export class RealRosterProvider implements RosterProvider {
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports';
  
  constructor(_config?: RealProviderConfig) {
    // ESPN doesn't require API keys
  }
  
  /**
   * Get rosters from ESPN API.
   * Note: This requires game data to include team IDs.
   */
  async getRosters(gameIds: string[], sport: SportCode): Promise<RosterMap> {
    const mapping = SPORT_ESPN_MAP[sport];
    const rosterMap: RosterMap = new Map();
    
    if (!mapping) {
      console.warn(`No ESPN mapping for sport: ${sport}`);
      return rosterMap;
    }
    
    // For each game, we need to fetch rosters for both teams
    // This is typically done by first fetching game details to get team IDs
    for (const gameId of gameIds) {
      try {
        // Fetch game summary to get team IDs
        const summaryUrl = `${this.espnBaseUrl}/${mapping.sport}/${mapping.league}/summary`;
        const summaryResponse = await axios.get(summaryUrl, {
          params: { event: gameId },
          timeout: 10000,
        });
        
        const boxscore = summaryResponse.data.boxscore;
        if (!boxscore) continue;
        
        const teams = (boxscore.teams as Record<string, unknown>[]) ?? [];
        const players: RosterPlayer[] = [];
        
        for (const teamData of teams) {
          const team = teamData.team as Record<string, unknown>;
          const teamId = String(team?.id ?? '');
          const teamName = (team?.displayName as string) ?? '';
          
          // Try to get roster from boxscore players if available
          const boxscorePlayers = summaryResponse.data.boxscore?.players ?? [];
          const teamPlayers = boxscorePlayers.find((p: Record<string, unknown>) => 
            (p.team as Record<string, unknown>)?.id === team?.id
          );
          
          if (teamPlayers) {
            const statistics = (teamPlayers.statistics as Record<string, unknown>[]) ?? [];
            for (const stat of statistics) {
              for (const athlete of ((stat.athletes as Record<string, unknown>[]) ?? [])) {
                const athleteInfo = athlete.athlete as Record<string, unknown>;
                players.push({
                  playerId: String(athleteInfo?.id ?? ''),
                  playerName: (athleteInfo?.displayName as string) ?? '',
                  teamId,
                  teamName,
                  position: ((athleteInfo?.position as Record<string, unknown>)?.abbreviation as string) ?? '',
                  jerseyNumber: (athleteInfo?.jersey as string) ?? undefined,
                  isActive: true,
                });
              }
            }
          }
        }
        
        rosterMap.set(gameId, players);
      } catch (error) {
        console.warn(`Could not fetch roster for game ${gameId}:`, error);
        rosterMap.set(gameId, []);
      }
    }
    
    return rosterMap;
  }
}

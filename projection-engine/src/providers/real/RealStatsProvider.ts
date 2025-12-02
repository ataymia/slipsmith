/**
 * Real Stats Provider
 * 
 * Uses ESPN API (free, no key required) and balldontlie.io (free tier) for player and team statistics.
 * This is a production-ready implementation using publicly available endpoints.
 * 
 * =============================================================================
 * ESPN API ENDPOINTS:
 * =============================================================================
 * 
 * Team Statistics:
 *   https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}/statistics
 * 
 * Player Gamelog (historical stats):
 *   https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/athletes/{playerId}/gamelog
 * 
 * =============================================================================
 * BALLDONTLIE API (for NBA player stats):
 * =============================================================================
 * 
 * https://api.balldontlie.io/v1/stats?player_ids[]={playerId}&per_page={numGames}
 * 
 * Optional: Set BASKETBALL_API_KEY for higher rate limits
 * 
 * =============================================================================
 */

import axios from 'axios';
import {
  StatsProvider,
  SportCode,
  PlayerRecentStatsMap,
  TeamStatsMap,
  PlayerRecentStats,
  TeamStats,
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
  'LOL': null,
  'CSGO': null,
  'VALORANT': null,
  'DOTA2': null,
};

/**
 * Real implementation of StatsProvider using ESPN and balldontlie APIs.
 */
export class RealStatsProvider implements StatsProvider {
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports';
  private ballDontLieBaseUrl = 'https://api.balldontlie.io/v1';
  private basketballApiKey?: string;
  
  constructor(config?: RealProviderConfig) {
    this.basketballApiKey = config?.basketballApiKey;
  }
  
  /**
   * Get recent player stats from ESPN/balldontlie APIs.
   */
  async getRecentPlayerStats(
    playerIds: string[],
    sport: SportCode,
    lookbackGames: number = 10
  ): Promise<PlayerRecentStatsMap> {
    const statsMap: PlayerRecentStatsMap = new Map();
    
    // Use balldontlie for NBA (better stats API)
    if (sport === 'NBA' || sport === 'WNBA') {
      return this.getBasketballPlayerStats(playerIds, lookbackGames);
    }
    
    const mapping = SPORT_ESPN_MAP[sport];
    if (!mapping) {
      return statsMap;
    }
    
    // Use ESPN for other sports
    for (const playerId of playerIds) {
      try {
        const url = `${this.espnBaseUrl}/${mapping.sport}/${mapping.league}/athletes/${playerId}/gamelog`;
        const response = await axios.get(url, { timeout: 10000 });
        
        const seasonTypes = response.data.seasonTypes ?? [];
        const allStats: Record<string, number[]> = {};
        let gamesCount = 0;
        
        for (const seasonType of seasonTypes) {
          for (const category of (seasonType.categories ?? [])) {
            const events = category.events ?? [];
            
            for (const event of events) {
              if (gamesCount >= lookbackGames) break;
              
              const statValues = event.stats ?? [];
              for (let i = 0; i < statValues.length; i++) {
                const key = `stat_${i}`;
                if (!allStats[key]) allStats[key] = [];
                const value = parseFloat(statValues[i]) || 0;
                allStats[key].push(value);
              }
              gamesCount++;
            }
          }
        }
        
        // Average the stats
        const averagedStats: Record<string, number> = {};
        for (const [key, values] of Object.entries(allStats)) {
          if (values.length > 0) {
            averagedStats[key] = values.reduce((a, b) => a + b, 0) / values.length;
          }
        }
        
        statsMap.set(playerId, {
          playerId,
          playerName: `Player ${playerId}`,
          teamId: '',
          gamesPlayed: gamesCount,
          stats: averagedStats,
        });
      } catch (error) {
        console.warn(`Could not fetch stats for player ${playerId}`);
      }
    }
    
    return statsMap;
  }
  
  /**
   * Get basketball player stats from balldontlie API.
   */
  private async getBasketballPlayerStats(
    playerIds: string[],
    lookbackGames: number
  ): Promise<PlayerRecentStatsMap> {
    const statsMap: PlayerRecentStatsMap = new Map();
    
    for (const playerId of playerIds) {
      try {
        const headers: Record<string, string> = {};
        if (this.basketballApiKey) {
          headers['Authorization'] = this.basketballApiKey;
        }
        
        const response = await axios.get(`${this.ballDontLieBaseUrl}/stats`, {
          params: {
            player_ids: [playerId],
            per_page: lookbackGames,
          },
          headers,
          timeout: 10000,
        });
        
        const games = response.data.data ?? [];
        
        if (games.length === 0) continue;
        
        // Calculate averages
        const totals: Record<string, number> = {};
        const counts: Record<string, number> = {};
        
        for (const game of games) {
          for (const [key, value] of Object.entries(game)) {
            if (typeof value === 'number') {
              totals[key] = (totals[key] ?? 0) + value;
              counts[key] = (counts[key] ?? 0) + 1;
            }
          }
        }
        
        const averages: Record<string, number> = {};
        for (const key of Object.keys(totals)) {
          averages[key] = (totals[key] ?? 0) / (counts[key] ?? 1);
        }
        
        const firstGame = games[0] as Record<string, unknown>;
        const player = firstGame?.player as Record<string, unknown>;
        
        statsMap.set(playerId, {
          playerId,
          playerName: `${player?.first_name ?? ''} ${player?.last_name ?? ''}`.trim(),
          teamId: String((firstGame?.team as Record<string, unknown>)?.id ?? ''),
          gamesPlayed: games.length,
          stats: averages,
          lastGameDate: (firstGame?.game as Record<string, unknown>)?.date as string,
        });
      } catch (error) {
        console.warn(`Could not fetch basketball stats for player ${playerId}`);
      }
    }
    
    return statsMap;
  }
  
  /**
   * Get team stats from ESPN API.
   */
  async getHistoricalTeamStats(teamIds: string[], sport: SportCode): Promise<TeamStatsMap> {
    const statsMap: TeamStatsMap = new Map();
    const mapping = SPORT_ESPN_MAP[sport];
    
    if (!mapping) {
      return statsMap;
    }
    
    for (const teamId of teamIds) {
      try {
        const url = `${this.espnBaseUrl}/${mapping.sport}/${mapping.league}/teams/${teamId}/statistics`;
        const response = await axios.get(url, { timeout: 10000 });
        
        const splits = response.data.splits ?? {};
        const categories = splits.categories ?? [];
        
        const stats: Record<string, number> = {};
        
        for (const category of categories) {
          for (const stat of (category.stats ?? [])) {
            const value = stat.perGameValue ?? stat.value ?? 0;
            stats[stat.name] = typeof value === 'number' ? value : parseFloat(value) || 0;
          }
        }
        
        const team = response.data.team as Record<string, unknown>;
        
        statsMap.set(teamId, {
          teamId,
          teamName: (team?.displayName as string) ?? `Team ${teamId}`,
          gamesPlayed: stats['gamesPlayed'] ?? 0,
          stats,
        });
      } catch (error) {
        console.warn(`Could not fetch team stats for team ${teamId}`);
      }
    }
    
    return statsMap;
  }
}

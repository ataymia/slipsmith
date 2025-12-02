/**
 * Esports Data Provider
 * 
 * Provides data for esports titles (League of Legends, CS2, Valorant, Dota 2).
 * Uses Pandascore API and other esports data providers.
 * 
 * This is a flexible abstraction designed to work with multiple game titles.
 */

import axios from 'axios';
import {
  Sport,
  League,
  Schedule,
  Player,
  PlayerStats,
  EsportsPlayerStats,
  Game,
  Team,
  TeamProjection,
} from '../types';
import { BaseDataProvider } from './BaseProvider';

// League mappings
const ESPORTS_GAME_MAP: Record<string, string> = {
  'LOL': 'lol',            // League of Legends
  'CSGO': 'csgo',          // Counter-Strike (CS2)
  'VALORANT': 'valorant',  // Valorant
  'DOTA2': 'dota2',        // Dota 2
};

export class EsportsProvider extends BaseDataProvider {
  sport: Sport = 'esports';
  supportedLeagues: League[] = ['LOL', 'CSGO', 'VALORANT', 'DOTA2'];
  
  // Pandascore API - free tier available with API key
  private pandasBaseUrl = 'https://api.pandascore.co';
  
  constructor(apiKey?: string) {
    super(apiKey);
    this.baseUrl = this.pandasBaseUrl;
  }
  
  async getSchedule(league: League, date: string): Promise<Schedule> {
    this.validateLeague(league);
    const formattedDate = this.formatDate(date);
    const gameSlug = ESPORTS_GAME_MAP[league] ?? league.toLowerCase();
    
    // If no API key, return mock data
    if (!this.apiKey) {
      return this.getMockSchedule(league, formattedDate);
    }
    
    try {
      const response = await axios.get(
        `${this.pandasBaseUrl}/${gameSlug}/matches/upcoming`,
        {
          params: {
            filter: {
              begin_at: formattedDate,
            },
            per_page: 50,
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );
      
      const games: Game[] = (response.data ?? []).map((match: Record<string, unknown>) => {
        const opponents = (match.opponents as Record<string, unknown>[]) ?? [];
        const opponent1 = (opponents[0]?.opponent as Record<string, unknown>) ?? {};
        const opponent2 = (opponents[1]?.opponent as Record<string, unknown>) ?? {};
        
        const homeTeam: Team = {
          id: String(opponent1.id ?? ''),
          name: (opponent1.name as string) ?? 'TBD',
          abbreviation: (opponent1.acronym as string) ?? '',
          league,
          sport: this.sport,
        };
        
        const awayTeam: Team = {
          id: String(opponent2.id ?? ''),
          name: (opponent2.name as string) ?? 'TBD',
          abbreviation: (opponent2.acronym as string) ?? '',
          league,
          sport: this.sport,
        };
        
        return {
          id: String(match.id),
          sport: this.sport,
          league,
          homeTeam,
          awayTeam,
          startTime: new Date(match.begin_at as string),
          venue: (match.league as Record<string, unknown>)?.name as string | undefined,
          status: this.mapMatchStatus(match.status as string),
        };
      });
      
      return {
        date: formattedDate,
        sport: this.sport,
        league,
        games,
      };
    } catch (error) {
      console.error(`Error fetching ${league} schedule:`, error);
      return this.getMockSchedule(league, formattedDate);
    }
  }
  
  async getTeamRoster(teamId: string): Promise<Player[]> {
    if (!this.apiKey) {
      return this.getMockRoster(teamId);
    }
    
    try {
      const response = await axios.get(
        `${this.pandasBaseUrl}/teams/${teamId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );
      
      const players = (response.data.players as Record<string, unknown>[]) ?? [];
      
      return players.map((player) => ({
        id: String(player.id),
        name: (player.name as string) ?? '',
        teamId,
        position: this.getEsportsPosition(player.role as string),
        status: 'active' as const,
        injuryStatus: 'healthy' as const,
      }));
    } catch (error) {
      console.error(`Error fetching roster for team ${teamId}:`, error);
      return this.getMockRoster(teamId);
    }
  }
  
  async getPlayerStats(playerId: string, numGames: number = 10): Promise<PlayerStats[]> {
    if (!this.apiKey) {
      return this.getMockPlayerStats(playerId, numGames);
    }
    
    try {
      const response = await axios.get(
        `${this.pandasBaseUrl}/players/${playerId}/stats`,
        {
          params: {
            per_page: numGames,
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );
      
      const stats = response.data ?? [];
      
      return stats.map((stat: Record<string, unknown>) => ({
        playerId,
        gameId: String(stat.game_id ?? ''),
        date: new Date().toISOString().split('T')[0] as string,
        kills: (stat.kills as number) ?? 0,
        deaths: (stat.deaths as number) ?? 0,
        assists: (stat.assists as number) ?? 0,
        cs: (stat.cs as number) ?? 0,
        gold: (stat.gold as number) ?? 0,
        damageDealt: (stat.damage_dealt as number) ?? 0,
        visionScore: (stat.vision_score as number) ?? 0,
      } as EsportsPlayerStats));
    } catch (error) {
      console.error(`Error fetching stats for player ${playerId}:`, error);
      return this.getMockPlayerStats(playerId, numGames);
    }
  }
  
  async getTeamStats(teamId: string, numGames: number = 10): Promise<Record<string, number>> {
    // Esports team stats are often calculated from player stats
    return {
      killsPerGame: 12 + Math.random() * 8,
      deathsPerGame: 8 + Math.random() * 8,
      goldPerMinute: 350 + Math.random() * 100,
      averageGameLength: 25 + Math.random() * 15,
      winRate: 0.4 + Math.random() * 0.3,
    };
  }
  
  async getInjuryReport(league: League): Promise<Player[]> {
    // Esports doesn't have traditional injuries
    // Could be used for roster changes, suspensions, etc.
    return [];
  }
  
  async getGameBoxScore(gameId: string): Promise<{
    home: { team: TeamProjection; players: PlayerStats[] };
    away: { team: TeamProjection; players: PlayerStats[] };
  } | null> {
    if (!this.apiKey) {
      return null;
    }
    
    try {
      const response = await axios.get(
        `${this.pandasBaseUrl}/matches/${gameId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );
      
      const match = response.data;
      if (!match.games || match.games.length === 0) return null;
      
      const opponents = (match.opponents as Record<string, unknown>[]) ?? [];
      const opponent1 = (opponents[0]?.opponent as Record<string, unknown>) ?? {};
      const opponent2 = (opponents[1]?.opponent as Record<string, unknown>) ?? {};
      
      return {
        home: {
          team: {
            teamId: String(opponent1.id ?? ''),
            teamName: (opponent1.name as string) ?? 'TBD',
            gameId,
            sport: this.sport,
            league: 'LOL',
            projectedScore: 0,
            projectedStats: {},
            confidence: 1.0,
          },
          players: [],
        },
        away: {
          team: {
            teamId: String(opponent2.id ?? ''),
            teamName: (opponent2.name as string) ?? 'TBD',
            gameId,
            sport: this.sport,
            league: 'LOL',
            projectedScore: 0,
            projectedStats: {},
            confidence: 1.0,
          },
          players: [],
        },
      };
    } catch (error) {
      console.error(`Error fetching box score for game ${gameId}:`, error);
      return null;
    }
  }
  
  // Helper methods
  private mapMatchStatus(status: string): Game['status'] {
    switch (status?.toLowerCase()) {
      case 'not_started': return 'scheduled';
      case 'running': return 'in_progress';
      case 'finished': return 'final';
      case 'canceled': return 'cancelled';
      case 'postponed': return 'postponed';
      default: return 'scheduled';
    }
  }
  
  private getEsportsPosition(role: string): string {
    const roleMap: Record<string, string> = {
      'top': 'TOP',
      'jungle': 'JNG',
      'mid': 'MID',
      'adc': 'ADC',
      'bot': 'ADC',
      'support': 'SUP',
    };
    return roleMap[role?.toLowerCase()] ?? role ?? 'FLEX';
  }
  
  // Mock data methods for when no API key is available
  private getMockSchedule(league: League, date: string): Schedule {
    const games: Game[] = [];
    const numGames = 2 + Math.floor(Math.random() * 4);
    
    for (let i = 0; i < numGames; i++) {
      const homeTeam: Team = {
        id: `team_home_${i}`,
        name: `Team ${String.fromCharCode(65 + i * 2)}`,
        abbreviation: `T${i * 2}`,
        league,
        sport: this.sport,
      };
      
      const awayTeam: Team = {
        id: `team_away_${i}`,
        name: `Team ${String.fromCharCode(65 + i * 2 + 1)}`,
        abbreviation: `T${i * 2 + 1}`,
        league,
        sport: this.sport,
      };
      
      const gameDate = new Date(date);
      gameDate.setHours(12 + i * 3);
      
      games.push({
        id: `game_${date}_${i}`,
        sport: this.sport,
        league,
        homeTeam,
        awayTeam,
        startTime: gameDate,
        venue: `${league} Tournament`,
        status: 'scheduled',
      });
    }
    
    return {
      date,
      sport: this.sport,
      league,
      games,
    };
  }
  
  private getMockRoster(teamId: string): Player[] {
    const positions = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
    return positions.map((pos, idx) => ({
      id: `player_${teamId}_${idx}`,
      name: `Player ${idx + 1}`,
      teamId,
      position: pos,
      status: 'active' as const,
      injuryStatus: 'healthy' as const,
    }));
  }
  
  private getMockPlayerStats(playerId: string, numGames: number): EsportsPlayerStats[] {
    const stats: EsportsPlayerStats[] = [];
    const today = new Date();
    
    for (let i = 0; i < numGames; i++) {
      const gameDate = new Date(today);
      gameDate.setDate(gameDate.getDate() - (i + 1) * 3);
      
      stats.push({
        playerId,
        gameId: `game_${i}`,
        date: gameDate.toISOString().split('T')[0] as string,
        kills: Math.floor(Math.random() * 15),
        deaths: Math.floor(Math.random() * 8),
        assists: Math.floor(Math.random() * 12),
        cs: 150 + Math.floor(Math.random() * 150),
        gold: 8000 + Math.floor(Math.random() * 8000),
        damageDealt: 10000 + Math.floor(Math.random() * 20000),
        visionScore: 10 + Math.floor(Math.random() * 40),
      });
    }
    
    return stats;
  }
  
  /**
   * Get game display name
   */
  getGameDisplayName(league: League): string {
    const names: Record<string, string> = {
      'LOL': 'League of Legends',
      'CSGO': 'Counter-Strike 2',
      'VALORANT': 'Valorant',
      'DOTA2': 'Dota 2',
    };
    return names[league] ?? league;
  }
}

export default EsportsProvider;

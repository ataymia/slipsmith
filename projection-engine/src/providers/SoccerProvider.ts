/**
 * Soccer Data Provider
 * 
 * Provides data for major soccer leagues worldwide.
 * Uses ESPN API (free) and API-Football as alternatives.
 * 
 * Designed to be league-agnostic and easily extensible.
 */

import axios from 'axios';
import {
  Sport,
  League,
  Schedule,
  Player,
  PlayerStats,
  SoccerPlayerStats,
  Game,
  Team,
  TeamProjection,
  InjuryStatus,
} from '../types';
import { BaseDataProvider } from './BaseProvider';

// League mappings for ESPN
const LEAGUE_ESPN_MAP: Record<string, string> = {
  'EPL': 'eng.1',           // English Premier League
  'LA_LIGA': 'esp.1',       // Spanish La Liga
  'BUNDESLIGA': 'ger.1',    // German Bundesliga
  'SERIE_A': 'ita.1',       // Italian Serie A
  'LIGUE_1': 'fra.1',       // French Ligue 1
  'MLS': 'usa.1',           // Major League Soccer
  'UEFA_CL': 'uefa.champions', // UEFA Champions League
};

export class SoccerProvider extends BaseDataProvider {
  sport: Sport = 'soccer';
  supportedLeagues: League[] = ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1', 'MLS', 'UEFA_CL'];
  
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
  
  constructor(apiKey?: string) {
    super(apiKey);
    this.baseUrl = this.espnBaseUrl;
  }
  
  async getSchedule(league: League, date: string): Promise<Schedule> {
    this.validateLeague(league);
    const formattedDate = this.formatDate(date);
    const espnLeague = LEAGUE_ESPN_MAP[league] ?? league.toLowerCase();
    
    try {
      const response = await axios.get(
        `${this.espnBaseUrl}/${espnLeague}/scoreboard`,
        {
          params: { dates: formattedDate.replace(/-/g, '') },
          timeout: 10000,
        }
      );
      
      const games: Game[] = (response.data.events ?? []).map((event: Record<string, unknown>) => {
        const competition = (event.competitions as Record<string, unknown>[])?.[0];
        const competitors = (competition?.competitors as Record<string, unknown>[]) ?? [];
        const homeTeamData = competitors.find((c) => c.homeAway === 'home') as Record<string, unknown> | undefined;
        const awayTeamData = competitors.find((c) => c.homeAway === 'away') as Record<string, unknown> | undefined;
        
        const homeTeam: Team = {
          id: (homeTeamData?.id as string) ?? '',
          name: ((homeTeamData?.team as Record<string, unknown>)?.displayName as string) ?? '',
          abbreviation: ((homeTeamData?.team as Record<string, unknown>)?.abbreviation as string) ?? '',
          league,
          sport: this.sport,
        };
        
        const awayTeam: Team = {
          id: (awayTeamData?.id as string) ?? '',
          name: ((awayTeamData?.team as Record<string, unknown>)?.displayName as string) ?? '',
          abbreviation: ((awayTeamData?.team as Record<string, unknown>)?.abbreviation as string) ?? '',
          league,
          sport: this.sport,
        };
        
        return {
          id: event.id as string,
          sport: this.sport,
          league,
          homeTeam,
          awayTeam,
          startTime: new Date(event.date as string),
          venue: ((competition?.venue as Record<string, unknown>)?.fullName as string) ?? undefined,
          status: this.mapGameStatus(event.status as Record<string, unknown>),
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
      return {
        date: formattedDate,
        sport: this.sport,
        league,
        games: [],
      };
    }
  }
  
  /**
   * Get team roster from ESPN API.
   * @param teamId - The team ID
   * @param league - Optional league to use for API routing, defaults to EPL
   */
  async getTeamRoster(teamId: string, league?: League): Promise<Player[]> {
    try {
      const espnLeague = league ? (LEAGUE_ESPN_MAP[league] ?? 'eng.1') : 'eng.1';
      const response = await axios.get(
        `${this.espnBaseUrl}/${espnLeague}/teams/${teamId}/roster`,
        { timeout: 10000 }
      );
      
      const players: Player[] = [];
      const athleteGroups = response.data.athletes ?? [];
      
      for (const group of athleteGroups) {
        for (const athlete of (group.items ?? [])) {
          players.push({
            id: athlete.id,
            name: athlete.displayName,
            teamId,
            position: athlete.position?.abbreviation ?? '',
            jerseyNumber: athlete.jersey,
            status: 'active',
            injuryStatus: 'healthy',
          });
        }
      }
      
      return players;
    } catch (error) {
      console.error(`Error fetching roster for team ${teamId}:`, error);
      return [];
    }
  }
  
  async getPlayerStats(playerId: string, numGames: number = 10): Promise<PlayerStats[]> {
    try {
      // ESPN doesn't have great historical player stats for soccer
      // In production, use API-Football or similar service
      const response = await axios.get(
        `${this.espnBaseUrl}/eng.1/athletes/${playerId}/statistics`,
        { timeout: 10000 }
      );
      
      const stats: SoccerPlayerStats[] = [];
      const splits = response.data.splits ?? [];
      
      for (const split of splits.slice(0, numGames)) {
        const categories = split.categories ?? [];
        const statMap: Record<string, number> = {};
        
        for (const category of categories) {
          for (const stat of (category.stats ?? [])) {
            statMap[stat.name] = stat.value ?? 0;
          }
        }
        
        stats.push({
          playerId,
          gameId: split.id ?? '',
          date: split.date ?? '',
          minutesPlayed: statMap['minutesPlayed'] ?? 0,
          goals: statMap['goals'] ?? 0,
          assists: statMap['assists'] ?? 0,
          shots: statMap['totalShots'] ?? 0,
          shotsOnTarget: statMap['shotsOnTarget'] ?? 0,
          keyPasses: statMap['keyPasses'] ?? 0,
          tackles: statMap['tackles'] ?? 0,
          interceptions: statMap['interceptions'] ?? 0,
          clearances: statMap['clearances'] ?? 0,
          yellowCards: statMap['yellowCards'] ?? 0,
          redCards: statMap['redCards'] ?? 0,
        });
      }
      
      return stats;
    } catch (error) {
      console.error(`Error fetching stats for player ${playerId}:`, error);
      return [];
    }
  }
  
  async getTeamStats(teamId: string, numGames: number = 10): Promise<Record<string, number>> {
    try {
      const response = await axios.get(
        `${this.espnBaseUrl}/eng.1/teams/${teamId}/statistics`,
        { timeout: 10000 }
      );
      
      const splits = response.data.splits ?? {};
      const categories = splits.categories ?? [];
      
      const stats: Record<string, number> = {};
      
      for (const category of categories) {
        for (const stat of (category.stats ?? [])) {
          stats[stat.name] = stat.perGameValue ?? stat.value ?? 0;
        }
      }
      
      return {
        goalsPerGame: stats['goals'] ? stats['goals'] / (stats['gamesPlayed'] ?? 1) : 1.5,
        goalsAgainstPerGame: stats['goalsAgainst'] ? stats['goalsAgainst'] / (stats['gamesPlayed'] ?? 1) : 1.2,
        shotsPerGame: stats['totalShots'] ? stats['totalShots'] / (stats['gamesPlayed'] ?? 1) : 12,
        possessionPercent: stats['possession'] ?? 50,
        passAccuracy: stats['passCompletionPct'] ?? 80,
        ...stats,
      };
    } catch (error) {
      console.error(`Error fetching team stats for ${teamId}:`, error);
      return {
        goalsPerGame: 1.5,
        goalsAgainstPerGame: 1.2,
        shotsPerGame: 12,
        possessionPercent: 50,
        passAccuracy: 80,
      };
    }
  }
  
  async getInjuryReport(league: League): Promise<Player[]> {
    this.validateLeague(league);
    const espnLeague = LEAGUE_ESPN_MAP[league] ?? league.toLowerCase();
    
    try {
      // Note: ESPN soccer injury endpoint may not exist
      // This is a placeholder for production integration
      const response = await axios.get(
        `${this.espnBaseUrl}/${espnLeague}/injuries`,
        { timeout: 10000 }
      );
      
      const injuries: Player[] = [];
      
      for (const team of (response.data.injuries ?? [])) {
        for (const item of (team.injuries ?? [])) {
          injuries.push({
            id: item.athlete?.id ?? '',
            name: item.athlete?.displayName ?? '',
            teamId: team.team?.id ?? '',
            position: item.athlete?.position?.abbreviation ?? '',
            status: 'active',
            injuryStatus: this.mapInjuryStatus(item.status),
            injuryNote: item.details?.detail ?? item.longComment ?? '',
          });
        }
      }
      
      return injuries;
    } catch (error) {
      // Silently return empty array if endpoint doesn't exist
      return [];
    }
  }
  
  async getGameBoxScore(gameId: string): Promise<{
    home: { team: TeamProjection; players: PlayerStats[] };
    away: { team: TeamProjection; players: PlayerStats[] };
  } | null> {
    try {
      const response = await axios.get(
        `${this.espnBaseUrl}/eng.1/summary`,
        {
          params: { event: gameId },
          timeout: 10000,
        }
      );
      
      const boxscore = response.data.boxscore;
      if (!boxscore) return null;
      
      const teams = boxscore.teams ?? [];
      const players = boxscore.players ?? [];
      
      const homeTeamData = teams.find((t: Record<string, unknown>) => 
        (t.homeAway as string) === 'home'
      ) as Record<string, unknown> | undefined;
      const awayTeamData = teams.find((t: Record<string, unknown>) => 
        (t.homeAway as string) === 'away'
      ) as Record<string, unknown> | undefined;
      
      if (!homeTeamData || !awayTeamData) return null;
      
      return {
        home: {
          team: this.parseTeamProjection(homeTeamData, gameId, 'EPL'),
          players: this.parsePlayerStats(players, 'home'),
        },
        away: {
          team: this.parseTeamProjection(awayTeamData, gameId, 'EPL'),
          players: this.parsePlayerStats(players, 'away'),
        },
      };
    } catch (error) {
      console.error(`Error fetching box score for game ${gameId}:`, error);
      return null;
    }
  }
  
  // Helper methods
  private mapGameStatus(status: Record<string, unknown> | undefined): Game['status'] {
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
  
  private mapInjuryStatus(status: string): InjuryStatus {
    const statusLower = (status ?? '').toLowerCase();
    if (statusLower.includes('out')) return 'out';
    if (statusLower.includes('doubtful')) return 'doubtful';
    if (statusLower.includes('questionable')) return 'questionable';
    if (statusLower.includes('probable')) return 'probable';
    return 'healthy';
  }
  
  private parseTeamProjection(teamData: Record<string, unknown>, gameId: string, league: League): TeamProjection {
    const team = teamData.team as Record<string, unknown>;
    const statistics = (teamData.statistics as Record<string, unknown>[]) ?? [];
    
    const stats: Record<string, number> = {};
    for (const stat of statistics) {
      const name = stat.name as string;
      const value = parseFloat(stat.displayValue as string) || 0;
      stats[name] = value;
    }
    
    return {
      teamId: (team?.id as string) ?? '',
      teamName: (team?.displayName as string) ?? '',
      gameId,
      sport: this.sport,
      league,
      projectedScore: stats['goals'] ?? 0,
      projectedStats: stats,
      confidence: 1.0,
    };
  }
  
  private parsePlayerStats(playersData: Record<string, unknown>[], homeAway: string): SoccerPlayerStats[] {
    const teamPlayers = playersData.find((p) => 
      (p.team as Record<string, unknown>)?.homeAway === homeAway
    ) as Record<string, unknown> | undefined;
    
    if (!teamPlayers) return [];
    
    const statistics = (teamPlayers.statistics as Record<string, unknown>[]) ?? [];
    const stats: SoccerPlayerStats[] = [];
    
    for (const category of statistics) {
      const athletes = (category.athletes as Record<string, unknown>[]) ?? [];
      
      for (const athlete of athletes) {
        const athleteInfo = athlete.athlete as Record<string, unknown>;
        const statValues = (athlete.stats as string[]) ?? [];
        
        stats.push({
          playerId: (athleteInfo?.id as string) ?? '',
          gameId: '',
          date: new Date().toISOString().split('T')[0] as string,
          minutesPlayed: parseInt(statValues[0] ?? '0', 10),
          goals: parseInt(statValues[1] ?? '0', 10),
          assists: parseInt(statValues[2] ?? '0', 10),
          shots: parseInt(statValues[3] ?? '0', 10),
          shotsOnTarget: parseInt(statValues[4] ?? '0', 10),
          keyPasses: 0,
          tackles: 0,
          interceptions: 0,
          clearances: 0,
          yellowCards: 0,
          redCards: 0,
        });
      }
    }
    
    return stats;
  }
  
  /**
   * Get league display name
   */
  getLeagueDisplayName(league: League): string {
    const names: Record<string, string> = {
      'EPL': 'English Premier League',
      'LA_LIGA': 'La Liga',
      'BUNDESLIGA': 'Bundesliga',
      'SERIE_A': 'Serie A',
      'LIGUE_1': 'Ligue 1',
      'MLS': 'Major League Soccer',
      'UEFA_CL': 'UEFA Champions League',
    };
    return names[league] ?? league;
  }
}

export default SoccerProvider;

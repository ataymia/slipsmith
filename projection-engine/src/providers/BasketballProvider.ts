/**
 * Basketball Data Provider
 * 
 * Provides data for NBA and WNBA leagues.
 * Uses balldontlie.io API (free tier) and ESPN API as backup.
 * 
 * API Documentation: https://docs.balldontlie.io/
 */

import axios from 'axios';
import {
  Sport,
  League,
  Schedule,
  Player,
  PlayerStats,
  BasketballPlayerStats,
  Game,
  Team,
  TeamProjection,
  InjuryStatus,
} from '../types';
import { BaseDataProvider } from './BaseProvider';

// Team mappings for common abbreviations
const NBA_TEAMS: Record<string, { id: string; name: string; abbreviation: string }> = {
  'ATL': { id: '1', name: 'Atlanta Hawks', abbreviation: 'ATL' },
  'BOS': { id: '2', name: 'Boston Celtics', abbreviation: 'BOS' },
  'BKN': { id: '3', name: 'Brooklyn Nets', abbreviation: 'BKN' },
  'CHA': { id: '4', name: 'Charlotte Hornets', abbreviation: 'CHA' },
  'CHI': { id: '5', name: 'Chicago Bulls', abbreviation: 'CHI' },
  'CLE': { id: '6', name: 'Cleveland Cavaliers', abbreviation: 'CLE' },
  'DAL': { id: '7', name: 'Dallas Mavericks', abbreviation: 'DAL' },
  'DEN': { id: '8', name: 'Denver Nuggets', abbreviation: 'DEN' },
  'DET': { id: '9', name: 'Detroit Pistons', abbreviation: 'DET' },
  'GSW': { id: '10', name: 'Golden State Warriors', abbreviation: 'GSW' },
  'HOU': { id: '11', name: 'Houston Rockets', abbreviation: 'HOU' },
  'IND': { id: '12', name: 'Indiana Pacers', abbreviation: 'IND' },
  'LAC': { id: '13', name: 'Los Angeles Clippers', abbreviation: 'LAC' },
  'LAL': { id: '14', name: 'Los Angeles Lakers', abbreviation: 'LAL' },
  'MEM': { id: '15', name: 'Memphis Grizzlies', abbreviation: 'MEM' },
  'MIA': { id: '16', name: 'Miami Heat', abbreviation: 'MIA' },
  'MIL': { id: '17', name: 'Milwaukee Bucks', abbreviation: 'MIL' },
  'MIN': { id: '18', name: 'Minnesota Timberwolves', abbreviation: 'MIN' },
  'NOP': { id: '19', name: 'New Orleans Pelicans', abbreviation: 'NOP' },
  'NYK': { id: '20', name: 'New York Knicks', abbreviation: 'NYK' },
  'OKC': { id: '21', name: 'Oklahoma City Thunder', abbreviation: 'OKC' },
  'ORL': { id: '22', name: 'Orlando Magic', abbreviation: 'ORL' },
  'PHI': { id: '23', name: 'Philadelphia 76ers', abbreviation: 'PHI' },
  'PHX': { id: '24', name: 'Phoenix Suns', abbreviation: 'PHX' },
  'POR': { id: '25', name: 'Portland Trail Blazers', abbreviation: 'POR' },
  'SAC': { id: '26', name: 'Sacramento Kings', abbreviation: 'SAC' },
  'SAS': { id: '27', name: 'San Antonio Spurs', abbreviation: 'SAS' },
  'TOR': { id: '28', name: 'Toronto Raptors', abbreviation: 'TOR' },
  'UTA': { id: '29', name: 'Utah Jazz', abbreviation: 'UTA' },
  'WAS': { id: '30', name: 'Washington Wizards', abbreviation: 'WAS' },
};

export class BasketballProvider extends BaseDataProvider {
  sport: Sport = 'basketball';
  supportedLeagues: League[] = ['NBA', 'WNBA'];
  
  private ballDontLieBaseUrl = 'https://api.balldontlie.io/v1';
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball';
  
  constructor(apiKey?: string) {
    super(apiKey);
    this.baseUrl = this.ballDontLieBaseUrl;
  }
  
  async getSchedule(league: League, date: string): Promise<Schedule> {
    this.validateLeague(league);
    const formattedDate = this.formatDate(date);
    
    try {
      // Try ESPN API first (free, no key required)
      const espnLeague = league.toLowerCase();
      const response = await axios.get(
        `${this.espnBaseUrl}/${espnLeague}/scoreboard`,
        {
          params: { dates: formattedDate.replace(/-/g, '') },
          timeout: 10000,
        }
      );
      
      const games: Game[] = (response.data.events ?? []).map((event: Record<string, unknown>) => {
        const competition = (event.competitions as Record<string, unknown>[])?.[0];
        const competitors = competition?.competitors as Record<string, unknown>[] ?? [];
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
      // Return empty schedule on error
      return {
        date: formattedDate,
        sport: this.sport,
        league,
        games: [],
      };
    }
  }
  
  async getTeamRoster(teamId: string): Promise<Player[]> {
    try {
      // Use ESPN API for roster
      const response = await axios.get(
        `${this.espnBaseUrl}/nba/teams/${teamId}/roster`,
        { timeout: 10000 }
      );
      
      return ((response.data.athletes as Record<string, unknown>[]) ?? []).map((athlete: Record<string, unknown>) => ({
        id: athlete.id as string,
        name: athlete.displayName as string,
        teamId,
        position: (athlete.position as Record<string, unknown>)?.abbreviation as string ?? '',
        jerseyNumber: athlete.jersey as string | undefined,
        status: 'active' as const,
        injuryStatus: 'healthy' as InjuryStatus,
      }));
    } catch (error) {
      console.error(`Error fetching roster for team ${teamId}:`, error);
      return [];
    }
  }
  
  async getPlayerStats(playerId: string, numGames: number = 10): Promise<PlayerStats[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = this.apiKey;
      }
      
      // BallDontLie API for historical stats
      const response = await axios.get(
        `${this.ballDontLieBaseUrl}/stats`,
        {
          params: {
            player_ids: [playerId],
            per_page: numGames,
          },
          headers,
          timeout: 10000,
        }
      );
      
      return ((response.data.data as Record<string, unknown>[]) ?? []).map((stat: Record<string, unknown>) => {
        const game = stat.game as Record<string, unknown>;
        return {
          playerId,
          gameId: game?.id as string ?? '',
          date: game?.date as string ?? '',
          minutesPlayed: this.parseMinutes(stat.min as string),
          points: (stat.pts as number) ?? 0,
          rebounds: (stat.reb as number) ?? 0,
          assists: (stat.ast as number) ?? 0,
          steals: (stat.stl as number) ?? 0,
          blocks: (stat.blk as number) ?? 0,
          turnovers: (stat.turnover as number) ?? 0,
          threePointersMade: (stat.fg3m as number) ?? 0,
          threePointersAttempted: (stat.fg3a as number) ?? 0,
          fieldGoalsMade: (stat.fgm as number) ?? 0,
          fieldGoalsAttempted: (stat.fga as number) ?? 0,
          freeThrowsMade: (stat.ftm as number) ?? 0,
          freeThrowsAttempted: (stat.fta as number) ?? 0,
        } as BasketballPlayerStats;
      });
    } catch (error) {
      console.error(`Error fetching stats for player ${playerId}:`, error);
      return [];
    }
  }
  
  async getTeamStats(teamId: string, numGames: number = 10): Promise<Record<string, number>> {
    try {
      // Calculate team averages from recent games
      const response = await axios.get(
        `${this.espnBaseUrl}/nba/teams/${teamId}/statistics`,
        { timeout: 10000 }
      );
      
      const stats = response.data.statistics ?? {};
      return {
        pointsPerGame: parseFloat(stats.points?.perGame ?? '100'),
        reboundsPerGame: parseFloat(stats.rebounds?.perGame ?? '40'),
        assistsPerGame: parseFloat(stats.assists?.perGame ?? '22'),
        pace: 100, // Default pace factor
        offensiveRating: 110,
        defensiveRating: 110,
      };
    } catch (error) {
      console.error(`Error fetching team stats for ${teamId}:`, error);
      return {
        pointsPerGame: 110,
        reboundsPerGame: 43,
        assistsPerGame: 25,
        pace: 100,
        offensiveRating: 110,
        defensiveRating: 110,
      };
    }
  }
  
  async getInjuryReport(league: League): Promise<Player[]> {
    this.validateLeague(league);
    
    try {
      const espnLeague = league.toLowerCase();
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
      console.error(`Error fetching ${league} injury report:`, error);
      return [];
    }
  }
  
  async getGameBoxScore(gameId: string): Promise<{
    home: { team: TeamProjection; players: PlayerStats[] };
    away: { team: TeamProjection; players: PlayerStats[] };
  } | null> {
    try {
      const response = await axios.get(
        `${this.espnBaseUrl}/nba/summary`,
        {
          params: { event: gameId },
          timeout: 10000,
        }
      );
      
      const boxscore = response.data.boxscore;
      if (!boxscore) return null;
      
      // Parse home and away stats
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
          team: this.parseTeamProjection(homeTeamData, gameId),
          players: this.parsePlayerStats(players, 'home'),
        },
        away: {
          team: this.parseTeamProjection(awayTeamData, gameId),
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
      case 'STATUS_IN_PROGRESS': return 'in_progress';
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
    if (statusLower.includes('day-to-day') || statusLower.includes('dtd')) return 'day-to-day';
    return 'healthy';
  }
  
  private parseMinutes(minStr: string | undefined): number {
    if (!minStr) return 0;
    const parts = minStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0] ?? '0', 10) + parseInt(parts[1] ?? '0', 10) / 60;
    }
    return parseInt(minStr, 10) || 0;
  }
  
  private parseTeamProjection(teamData: Record<string, unknown>, gameId: string): TeamProjection {
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
      league: 'NBA',
      projectedScore: stats['points'] ?? 0,
      projectedStats: stats,
      confidence: 1.0,
    };
  }
  
  private parsePlayerStats(playersData: Record<string, unknown>[], homeAway: string): BasketballPlayerStats[] {
    const teamPlayers = playersData.find((p) => 
      (p.team as Record<string, unknown>)?.homeAway === homeAway
    ) as Record<string, unknown> | undefined;
    
    if (!teamPlayers) return [];
    
    const statistics = (teamPlayers.statistics as Record<string, unknown>[]) ?? [];
    const athleteStats = statistics[0] as Record<string, unknown> | undefined;
    if (!athleteStats) return [];
    
    const athletes = (athleteStats.athletes as Record<string, unknown>[]) ?? [];
    
    return athletes.map((athlete: Record<string, unknown>) => {
      const stats = (athlete.stats as string[]) ?? [];
      const athleteInfo = athlete.athlete as Record<string, unknown>;
      
      return {
        playerId: (athleteInfo?.id as string) ?? '',
        gameId: '',
        date: new Date().toISOString().split('T')[0] as string,
        minutesPlayed: this.parseMinutes(stats[0]),
        fieldGoalsMade: parseInt(stats[1]?.split('-')[0] ?? '0', 10),
        fieldGoalsAttempted: parseInt(stats[1]?.split('-')[1] ?? '0', 10),
        threePointersMade: parseInt(stats[2]?.split('-')[0] ?? '0', 10),
        threePointersAttempted: parseInt(stats[2]?.split('-')[1] ?? '0', 10),
        freeThrowsMade: parseInt(stats[3]?.split('-')[0] ?? '0', 10),
        freeThrowsAttempted: parseInt(stats[3]?.split('-')[1] ?? '0', 10),
        rebounds: parseInt(stats[6] ?? '0', 10),
        assists: parseInt(stats[7] ?? '0', 10),
        steals: parseInt(stats[9] ?? '0', 10),
        blocks: parseInt(stats[8] ?? '0', 10),
        turnovers: parseInt(stats[10] ?? '0', 10),
        points: parseInt(stats[13] ?? '0', 10),
      };
    });
  }
  
  /**
   * Get team info by abbreviation
   */
  getTeamByAbbreviation(abbr: string): { id: string; name: string; abbreviation: string } | undefined {
    return NBA_TEAMS[abbr.toUpperCase()];
  }
}

export default BasketballProvider;

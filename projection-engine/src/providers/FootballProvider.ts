/**
 * Football Data Provider
 * 
 * Provides data for NFL (and structured for NCAA extension).
 * Uses ESPN API (free, no key required).
 */

import axios from 'axios';
import {
  Sport,
  League,
  Schedule,
  Player,
  PlayerStats,
  FootballPlayerStats,
  Game,
  Team,
  TeamProjection,
  InjuryStatus,
} from '../types';
import { BaseDataProvider } from './BaseProvider';

// NFL team mappings
const NFL_TEAMS: Record<string, { id: string; name: string; abbreviation: string }> = {
  'ARI': { id: '22', name: 'Arizona Cardinals', abbreviation: 'ARI' },
  'ATL': { id: '1', name: 'Atlanta Falcons', abbreviation: 'ATL' },
  'BAL': { id: '33', name: 'Baltimore Ravens', abbreviation: 'BAL' },
  'BUF': { id: '2', name: 'Buffalo Bills', abbreviation: 'BUF' },
  'CAR': { id: '29', name: 'Carolina Panthers', abbreviation: 'CAR' },
  'CHI': { id: '3', name: 'Chicago Bears', abbreviation: 'CHI' },
  'CIN': { id: '4', name: 'Cincinnati Bengals', abbreviation: 'CIN' },
  'CLE': { id: '5', name: 'Cleveland Browns', abbreviation: 'CLE' },
  'DAL': { id: '6', name: 'Dallas Cowboys', abbreviation: 'DAL' },
  'DEN': { id: '7', name: 'Denver Broncos', abbreviation: 'DEN' },
  'DET': { id: '8', name: 'Detroit Lions', abbreviation: 'DET' },
  'GB': { id: '9', name: 'Green Bay Packers', abbreviation: 'GB' },
  'HOU': { id: '34', name: 'Houston Texans', abbreviation: 'HOU' },
  'IND': { id: '11', name: 'Indianapolis Colts', abbreviation: 'IND' },
  'JAX': { id: '30', name: 'Jacksonville Jaguars', abbreviation: 'JAX' },
  'KC': { id: '12', name: 'Kansas City Chiefs', abbreviation: 'KC' },
  'LV': { id: '13', name: 'Las Vegas Raiders', abbreviation: 'LV' },
  'LAC': { id: '24', name: 'Los Angeles Chargers', abbreviation: 'LAC' },
  'LAR': { id: '14', name: 'Los Angeles Rams', abbreviation: 'LAR' },
  'MIA': { id: '15', name: 'Miami Dolphins', abbreviation: 'MIA' },
  'MIN': { id: '16', name: 'Minnesota Vikings', abbreviation: 'MIN' },
  'NE': { id: '17', name: 'New England Patriots', abbreviation: 'NE' },
  'NO': { id: '18', name: 'New Orleans Saints', abbreviation: 'NO' },
  'NYG': { id: '19', name: 'New York Giants', abbreviation: 'NYG' },
  'NYJ': { id: '20', name: 'New York Jets', abbreviation: 'NYJ' },
  'PHI': { id: '21', name: 'Philadelphia Eagles', abbreviation: 'PHI' },
  'PIT': { id: '23', name: 'Pittsburgh Steelers', abbreviation: 'PIT' },
  'SF': { id: '25', name: 'San Francisco 49ers', abbreviation: 'SF' },
  'SEA': { id: '26', name: 'Seattle Seahawks', abbreviation: 'SEA' },
  'TB': { id: '27', name: 'Tampa Bay Buccaneers', abbreviation: 'TB' },
  'TEN': { id: '10', name: 'Tennessee Titans', abbreviation: 'TEN' },
  'WAS': { id: '28', name: 'Washington Commanders', abbreviation: 'WAS' },
};

export class FootballProvider extends BaseDataProvider {
  sport: Sport = 'football';
  supportedLeagues: League[] = ['NFL', 'NCAA_FB'];
  
  private espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football';
  
  constructor(apiKey?: string) {
    super(apiKey);
    this.baseUrl = this.espnBaseUrl;
  }
  
  async getSchedule(league: League, date: string): Promise<Schedule> {
    this.validateLeague(league);
    const formattedDate = this.formatDate(date);
    
    try {
      const espnLeague = league === 'NFL' ? 'nfl' : 'college-football';
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
  
  async getTeamRoster(teamId: string): Promise<Player[]> {
    try {
      const response = await axios.get(
        `${this.espnBaseUrl}/nfl/teams/${teamId}/roster`,
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
      const response = await axios.get(
        `${this.espnBaseUrl}/nfl/athletes/${playerId}/gamelog`,
        { timeout: 10000 }
      );
      
      const stats: FootballPlayerStats[] = [];
      const seasonTypes = response.data.seasonTypes ?? [];
      
      for (const seasonType of seasonTypes) {
        for (const category of (seasonType.categories ?? [])) {
          const events = category.events ?? [];
          
          for (let i = 0; i < Math.min(events.length, numGames); i++) {
            const event = events[i];
            const statValues = event.stats ?? [];
            
            stats.push({
              playerId,
              gameId: event.eventId ?? '',
              date: event.gameDate ?? '',
              passingYards: this.findStat(statValues, 'passingYards'),
              passingTouchdowns: this.findStat(statValues, 'passingTouchdowns'),
              interceptions: this.findStat(statValues, 'interceptions'),
              completions: this.findStat(statValues, 'completions'),
              attempts: this.findStat(statValues, 'passingAttempts'),
              rushingYards: this.findStat(statValues, 'rushingYards'),
              rushingTouchdowns: this.findStat(statValues, 'rushingTouchdowns'),
              carries: this.findStat(statValues, 'carries'),
              receivingYards: this.findStat(statValues, 'receivingYards'),
              receivingTouchdowns: this.findStat(statValues, 'receivingTouchdowns'),
              receptions: this.findStat(statValues, 'receptions'),
              targets: this.findStat(statValues, 'targets'),
              sacks: this.findStat(statValues, 'sacks'),
              tackles: this.findStat(statValues, 'totalTackles'),
            });
          }
        }
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
        `${this.espnBaseUrl}/nfl/teams/${teamId}/statistics`,
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
        pointsPerGame: stats['pointsPerGame'] ?? 22,
        yardsPerGame: stats['netTotalYards'] ?? 330,
        passingYardsPerGame: stats['netPassingYardsPerGame'] ?? 220,
        rushingYardsPerGame: stats['rushingYardsPerGame'] ?? 110,
        turnoversPerGame: stats['turnovers'] ? stats['turnovers'] / 17 : 1.5,
        ...stats,
      };
    } catch (error) {
      console.error(`Error fetching team stats for ${teamId}:`, error);
      return {
        pointsPerGame: 22,
        yardsPerGame: 330,
        passingYardsPerGame: 220,
        rushingYardsPerGame: 110,
        turnoversPerGame: 1.5,
      };
    }
  }
  
  async getInjuryReport(league: League): Promise<Player[]> {
    this.validateLeague(league);
    
    try {
      const espnLeague = league === 'NFL' ? 'nfl' : 'college-football';
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
        `${this.espnBaseUrl}/nfl/summary`,
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
  
  private findStat(statValues: unknown[], statName: string): number | undefined {
    // ESPN returns stats in array format based on position
    // This is a simplified version - in production, parse the actual stat structure
    return undefined;
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
      league: 'NFL',
      projectedScore: stats['points'] ?? 0,
      projectedStats: stats,
      confidence: 1.0,
    };
  }
  
  private parsePlayerStats(playersData: Record<string, unknown>[], homeAway: string): FootballPlayerStats[] {
    const teamPlayers = playersData.find((p) => 
      (p.team as Record<string, unknown>)?.homeAway === homeAway
    ) as Record<string, unknown> | undefined;
    
    if (!teamPlayers) return [];
    
    const statistics = (teamPlayers.statistics as Record<string, unknown>[]) ?? [];
    const stats: FootballPlayerStats[] = [];
    
    // Parse different stat categories (passing, rushing, receiving)
    for (const category of statistics) {
      const categoryName = category.name as string;
      const athletes = (category.athletes as Record<string, unknown>[]) ?? [];
      
      for (const athlete of athletes) {
        const athleteInfo = athlete.athlete as Record<string, unknown>;
        const statValues = (athlete.stats as string[]) ?? [];
        
        const playerStat: FootballPlayerStats = {
          playerId: (athleteInfo?.id as string) ?? '',
          gameId: '',
          date: new Date().toISOString().split('T')[0] as string,
        };
        
        // Map stats based on category
        if (categoryName === 'passing') {
          playerStat.completions = parseInt(statValues[0]?.split('/')[0] ?? '0', 10);
          playerStat.attempts = parseInt(statValues[0]?.split('/')[1] ?? '0', 10);
          playerStat.passingYards = parseInt(statValues[1] ?? '0', 10);
          playerStat.passingTouchdowns = parseInt(statValues[3] ?? '0', 10);
          playerStat.interceptions = parseInt(statValues[4] ?? '0', 10);
        } else if (categoryName === 'rushing') {
          playerStat.carries = parseInt(statValues[0] ?? '0', 10);
          playerStat.rushingYards = parseInt(statValues[1] ?? '0', 10);
          playerStat.rushingTouchdowns = parseInt(statValues[3] ?? '0', 10);
        } else if (categoryName === 'receiving') {
          playerStat.receptions = parseInt(statValues[0] ?? '0', 10);
          playerStat.receivingYards = parseInt(statValues[1] ?? '0', 10);
          playerStat.receivingTouchdowns = parseInt(statValues[3] ?? '0', 10);
        }
        
        stats.push(playerStat);
      }
    }
    
    return stats;
  }
  
  /**
   * Get team info by abbreviation
   */
  getTeamByAbbreviation(abbr: string): { id: string; name: string; abbreviation: string } | undefined {
    return NFL_TEAMS[abbr.toUpperCase()];
  }
}

export default FootballProvider;

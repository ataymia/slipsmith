/**
 * Mock Roster Provider
 * 
 * Provides mock team roster data for testing and development.
 * Generates realistic player rosters without external API calls.
 */

import {
  RosterProvider,
  SportCode,
  RosterMap,
  RosterPlayer,
} from '../interfaces';

/**
 * Mock implementation of RosterProvider.
 * Generates 10-15 players per team for testing purposes.
 */
export class MockRosterProvider implements RosterProvider {
  
  /**
   * Get mock rosters for the specified games.
   */
  async getRosters(gameIds: string[], sport: SportCode): Promise<RosterMap> {
    const rosterMap: RosterMap = new Map();
    
    for (const gameId of gameIds) {
      const players: RosterPlayer[] = [];
      
      // Generate home team players
      const homeTeamPlayers = this.generateTeamRoster(
        `home_${gameId}`,
        `Home Team`,
        sport,
        true
      );
      players.push(...homeTeamPlayers);
      
      // Generate away team players
      const awayTeamPlayers = this.generateTeamRoster(
        `away_${gameId}`,
        `Away Team`,
        sport,
        true
      );
      players.push(...awayTeamPlayers);
      
      rosterMap.set(gameId, players);
    }
    
    return rosterMap;
  }
  
  /**
   * Generate mock roster for a team.
   */
  private generateTeamRoster(
    teamId: string,
    teamName: string,
    sport: SportCode,
    isActive: boolean
  ): RosterPlayer[] {
    const positions = this.getPositionsForSport(sport);
    const numPlayers = 10 + Math.floor(Math.random() * 6);
    const players: RosterPlayer[] = [];
    
    const names = this.getPlayerNames();
    
    for (let i = 0; i < numPlayers; i++) {
      const position = positions[i % positions.length] ?? 'Player';
      const name = names[i % names.length] ?? `Player ${i + 1}`;
      
      players.push({
        playerId: `player_${teamId}_${i}`,
        playerName: `${name} ${i + 1}`,
        teamId,
        teamName,
        position,
        jerseyNumber: String(i + 1),
        isActive,
      });
    }
    
    return players;
  }
  
  /**
   * Get positions for a sport.
   */
  private getPositionsForSport(sport: SportCode): string[] {
    const positions: Record<string, string[]> = {
      'NBA': ['PG', 'SG', 'SF', 'PF', 'C'],
      'WNBA': ['G', 'F', 'C'],
      'NFL': ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'],
      'NCAA_FB': ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'],
      'EPL': ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      'LA_LIGA': ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      'BUNDESLIGA': ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      'SERIE_A': ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      'LIGUE_1': ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      'MLS': ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      'UEFA_CL': ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
      'LOL': ['TOP', 'JNG', 'MID', 'ADC', 'SUP'],
      'CSGO': ['AWP', 'RIFLE', 'ENTRY', 'LURK', 'IGL'],
      'VALORANT': ['DUELIST', 'CONTROLLER', 'SENTINEL', 'INITIATOR', 'FLEX'],
      'DOTA2': ['CARRY', 'MID', 'OFFLANE', 'SOFT_SUPPORT', 'HARD_SUPPORT'],
    };
    
    return positions[sport] ?? ['Player'];
  }
  
  /**
   * Get common player first names for mock data.
   */
  private getPlayerNames(): string[] {
    return [
      'James', 'Michael', 'Anthony', 'Kevin', 'Stephen',
      'LeBron', 'Jayson', 'Luka', 'Giannis', 'Nikola',
      'Patrick', 'Travis', 'Josh', 'Chris', 'Davante',
      'Mohamed', 'Erling', 'Kylian', 'Harry', 'Marcus',
      'Faker', 'Caps', 'ShowMaker', 'Chovy', 'Knight',
    ];
  }
}

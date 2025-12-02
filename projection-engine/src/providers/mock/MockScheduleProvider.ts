/**
 * Mock Schedule Provider
 * 
 * Provides mock game schedule data for testing and development.
 * Generates realistic-looking schedule data without external API calls.
 */

import {
  ScheduleProvider,
  SportCode,
  GameInfo,
} from '../interfaces';

/**
 * Mock implementation of ScheduleProvider.
 * Generates 3-8 games per sport per day for testing purposes.
 */
export class MockScheduleProvider implements ScheduleProvider {
  
  /**
   * Get mock games for the specified date and sport.
   */
  async getGames(date: string, sport: SportCode): Promise<GameInfo[]> {
    // Generate 3-8 mock games
    const numGames = 3 + Math.floor(Math.random() * 6);
    const games: GameInfo[] = [];
    
    const teams = this.getTeamsForSport(sport);
    const usedTeams = new Set<number>();
    
    for (let i = 0; i < numGames; i++) {
      // Pick two unique teams
      let homeIdx = Math.floor(Math.random() * teams.length);
      let awayIdx = Math.floor(Math.random() * teams.length);
      
      while (usedTeams.has(homeIdx) || usedTeams.has(awayIdx) || homeIdx === awayIdx) {
        homeIdx = Math.floor(Math.random() * teams.length);
        awayIdx = Math.floor(Math.random() * teams.length);
        if (usedTeams.size >= teams.length - 1) break;
      }
      
      usedTeams.add(homeIdx);
      usedTeams.add(awayIdx);
      
      const homeTeam = teams[homeIdx] ?? { id: `team_home_${i}`, name: `Home Team ${i}`, abbr: `HT${i}` };
      const awayTeam = teams[awayIdx] ?? { id: `team_away_${i}`, name: `Away Team ${i}`, abbr: `AT${i}` };
      
      const gameDate = new Date(date);
      gameDate.setHours(19 + i, 0, 0, 0); // Games at 7pm, 8pm, etc.
      
      games.push({
        gameId: `game_${date}_${i}`,
        sport,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        homeTeamAbbreviation: homeTeam.abbr,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        awayTeamAbbreviation: awayTeam.abbr,
        scheduledTime: gameDate,
        venue: `Arena ${i + 1}`,
        status: 'scheduled',
      });
    }
    
    return games;
  }
  
  /**
   * Get mock team data for a sport.
   */
  private getTeamsForSport(sport: SportCode): Array<{ id: string; name: string; abbr: string }> {
    const teamData: Record<string, Array<{ id: string; name: string; abbr: string }>> = {
      'NBA': [
        { id: 'lal', name: 'Los Angeles Lakers', abbr: 'LAL' },
        { id: 'bos', name: 'Boston Celtics', abbr: 'BOS' },
        { id: 'gsw', name: 'Golden State Warriors', abbr: 'GSW' },
        { id: 'mia', name: 'Miami Heat', abbr: 'MIA' },
        { id: 'den', name: 'Denver Nuggets', abbr: 'DEN' },
        { id: 'phx', name: 'Phoenix Suns', abbr: 'PHX' },
        { id: 'mil', name: 'Milwaukee Bucks', abbr: 'MIL' },
        { id: 'phi', name: 'Philadelphia 76ers', abbr: 'PHI' },
        { id: 'dal', name: 'Dallas Mavericks', abbr: 'DAL' },
        { id: 'nyk', name: 'New York Knicks', abbr: 'NYK' },
      ],
      'WNBA': [
        { id: 'las', name: 'Las Vegas Aces', abbr: 'LVA' },
        { id: 'nyl', name: 'New York Liberty', abbr: 'NYL' },
        { id: 'sea', name: 'Seattle Storm', abbr: 'SEA' },
        { id: 'chi', name: 'Chicago Sky', abbr: 'CHI' },
        { id: 'phx', name: 'Phoenix Mercury', abbr: 'PHX' },
        { id: 'min', name: 'Minnesota Lynx', abbr: 'MIN' },
      ],
      'NFL': [
        { id: 'kc', name: 'Kansas City Chiefs', abbr: 'KC' },
        { id: 'buf', name: 'Buffalo Bills', abbr: 'BUF' },
        { id: 'sf', name: 'San Francisco 49ers', abbr: 'SF' },
        { id: 'phi', name: 'Philadelphia Eagles', abbr: 'PHI' },
        { id: 'dal', name: 'Dallas Cowboys', abbr: 'DAL' },
        { id: 'mia', name: 'Miami Dolphins', abbr: 'MIA' },
        { id: 'det', name: 'Detroit Lions', abbr: 'DET' },
        { id: 'bal', name: 'Baltimore Ravens', abbr: 'BAL' },
      ],
    };
    
    // Return sport-specific teams or generate generic ones
    if (teamData[sport]) {
      return teamData[sport];
    }
    
    // Generate generic teams for other sports
    const generic: Array<{ id: string; name: string; abbr: string }> = [];
    for (let i = 0; i < 10; i++) {
      generic.push({
        id: `team_${sport.toLowerCase()}_${i}`,
        name: `${sport} Team ${i + 1}`,
        abbr: `T${i + 1}`,
      });
    }
    return generic;
  }
}

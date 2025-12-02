/**
 * Mock Odds Provider
 * 
 * Provides mock betting lines and prop markets for testing and development.
 * Generates realistic prop markets without external API calls.
 */

import {
  OddsProvider,
  SportCode,
  PropMarket,
  PropMarketType,
} from '../interfaces';

/**
 * Mock implementation of OddsProvider.
 * Generates realistic prop markets based on sport-specific conventions.
 */
export class MockOddsProvider implements OddsProvider {
  
  /**
   * Get mock consensus props for the specified date and sport.
   */
  async getConsensusProps(date: string, sport: SportCode): Promise<PropMarket[]> {
    // Generate 30-100 prop markets per sport/date
    const numProps = 30 + Math.floor(Math.random() * 70);
    const props: PropMarket[] = [];
    
    const marketTypes = this.getMarketTypesForSport(sport);
    const numGames = 3 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < numProps; i++) {
      const gameIndex = i % numGames;
      const marketType = marketTypes[i % marketTypes.length] ?? 'points';
      const isTeamMarket = this.isTeamMarket(marketType);
      
      const line = this.generateLineForMarket(marketType, sport);
      
      props.push({
        marketId: `prop_${date}_${sport}_${i}`,
        gameId: `game_${date}_${gameIndex}`,
        sport,
        playerId: isTeamMarket ? null : `player_${gameIndex}_${i % 15}`,
        playerName: isTeamMarket ? undefined : `Player ${i % 15 + 1}`,
        teamId: isTeamMarket ? `team_${gameIndex}_${i % 2 === 0 ? 'home' : 'away'}` : undefined,
        teamName: isTeamMarket ? `Team ${i % 2 === 0 ? 'Home' : 'Away'} ${gameIndex + 1}` : undefined,
        marketType,
        line,
        overOdds: -115 + Math.floor(Math.random() * 20),
        underOdds: -115 + Math.floor(Math.random() * 20),
        source: 'consensus',
        timestamp: new Date(),
      });
    }
    
    return props;
  }
  
  /**
   * Get market types for a sport.
   */
  private getMarketTypesForSport(sport: SportCode): PropMarketType[] {
    switch (sport) {
      case 'NBA':
      case 'WNBA':
        return [
          'points', 'rebounds', 'assists', 'threes', 'blocks', 'steals',
          'points+rebounds', 'points+assists', 'rebounds+assists',
          'points+rebounds+assists', 'team_total', 'game_total', 'spread',
        ];
      
      case 'NFL':
      case 'NCAA_FB':
        return [
          'passing_yards', 'rushing_yards', 'receiving_yards', 'receptions',
          'passing_touchdowns', 'rushing_touchdowns', 'receiving_touchdowns',
          'interceptions', 'team_total', 'game_total', 'spread',
        ];
      
      case 'EPL':
      case 'LA_LIGA':
      case 'BUNDESLIGA':
      case 'SERIE_A':
      case 'LIGUE_1':
      case 'MLS':
      case 'UEFA_CL':
        return [
          'goals', 'soccer_assists', 'shots', 'shots_on_target',
          'team_total', 'game_total',
        ];
      
      case 'LOL':
      case 'DOTA2':
      case 'CSGO':
      case 'VALORANT':
        return [
          'kills', 'deaths', 'esports_assists', 'team_total', 'game_total',
        ];
      
      default:
        return ['points', 'team_total', 'game_total'];
    }
  }
  
  /**
   * Check if a market type is a team/game market (not player-specific).
   */
  private isTeamMarket(marketType: PropMarketType): boolean {
    return ['team_total', 'game_total', 'spread', 'moneyline'].includes(marketType);
  }
  
  /**
   * Generate a realistic line for a market type.
   */
  private generateLineForMarket(marketType: PropMarketType, sport: SportCode): number {
    // Round to nearest 0.5
    const round = (n: number) => Math.round(n * 2) / 2;
    
    switch (marketType) {
      // Basketball player props
      case 'points':
        return round(10 + Math.random() * 25);
      case 'rebounds':
        return round(2 + Math.random() * 10);
      case 'assists':
        return round(1 + Math.random() * 10);
      case 'threes':
        return round(0.5 + Math.random() * 4);
      case 'blocks':
      case 'steals':
        return round(0.5 + Math.random() * 2.5);
      case 'points+rebounds':
        return round(12 + Math.random() * 30);
      case 'points+assists':
        return round(12 + Math.random() * 30);
      case 'rebounds+assists':
        return round(4 + Math.random() * 15);
      case 'points+rebounds+assists':
        return round(15 + Math.random() * 40);
      
      // Football player props
      case 'passing_yards':
        return round(180 + Math.random() * 150);
      case 'rushing_yards':
        return round(30 + Math.random() * 80);
      case 'receiving_yards':
        return round(30 + Math.random() * 80);
      case 'receptions':
        return round(2 + Math.random() * 7);
      case 'passing_touchdowns':
        return round(0.5 + Math.random() * 3);
      case 'rushing_touchdowns':
      case 'receiving_touchdowns':
        return round(0.5 + Math.random() * 1);
      case 'interceptions':
        return round(0.5 + Math.random() * 1.5);
      
      // Soccer props
      case 'goals':
        return round(0.5 + Math.random() * 0.5);
      case 'soccer_assists':
        return round(0.5 + Math.random() * 0.5);
      case 'shots':
        return round(1 + Math.random() * 3);
      case 'shots_on_target':
        return round(0.5 + Math.random() * 2);
      
      // Esports props
      case 'kills':
        return round(3 + Math.random() * 8);
      case 'deaths':
        return round(2 + Math.random() * 5);
      case 'esports_assists':
        return round(3 + Math.random() * 8);
      
      // Team/game props
      case 'team_total':
        if (['NBA', 'WNBA'].includes(sport)) return round(100 + Math.random() * 30);
        if (['NFL', 'NCAA_FB'].includes(sport)) return round(17 + Math.random() * 15);
        if (['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1', 'MLS', 'UEFA_CL'].includes(sport)) {
          return round(0.5 + Math.random() * 2);
        }
        return round(10 + Math.random() * 20);
      
      case 'game_total':
        if (['NBA', 'WNBA'].includes(sport)) return round(210 + Math.random() * 40);
        if (['NFL', 'NCAA_FB'].includes(sport)) return round(40 + Math.random() * 20);
        if (['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1', 'MLS', 'UEFA_CL'].includes(sport)) {
          return round(1.5 + Math.random() * 2);
        }
        return round(20 + Math.random() * 30);
      
      case 'spread':
        return round(-10 + Math.random() * 20);
      
      case 'moneyline':
        return Math.floor(-200 + Math.random() * 400);
      
      default:
        return round(5 + Math.random() * 20);
    }
  }
}

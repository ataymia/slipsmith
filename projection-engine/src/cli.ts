/**
 * SlipSmith CLI
 * 
 * Command-line interface for generating projections and managing evaluations.
 */

import * as dotenv from 'dotenv';
import { ProviderFactory, ProviderConfig } from './providers';
import { ProjectionEngine, EdgeDetector } from './engine';
import { EvaluationEngine } from './evaluation';
import { League, Sport } from './types';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Configuration
const config: ProviderConfig = {
  basketballApiKey: process.env.BASKETBALL_API_KEY,
  footballApiKey: process.env.FOOTBALL_API_KEY,
  soccerApiKey: process.env.SOCCER_API_KEY,
  esportsApiKey: process.env.ESPORTS_API_KEY,
  useMockData: process.env.USE_MOCK_DATA === 'true' || args.includes('--mock'),
};

const dbPath = process.env.DB_PATH ?? './data/slipsmith.db';

// Initialize components
const providerFactory = new ProviderFactory(config);
const projectionEngine = new ProjectionEngine(providerFactory);
const edgeDetector = new EdgeDetector();
const evaluationEngine = new EvaluationEngine(dbPath, providerFactory);

// Parse options
function parseOption(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

function getDate(dateArg: string | undefined): string {
  if (!dateArg || dateArg === 'today') {
    return new Date().toISOString().split('T')[0] as string;
  }
  if (dateArg === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0] as string;
  }
  if (dateArg === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0] as string;
  }
  return dateArg;
}

// Commands
async function generateProjections() {
  const sport = parseOption('sport')?.toLowerCase() as Sport | undefined;
  const leagueArg = parseOption('league')?.toUpperCase() as League | undefined;
  const dateArg = parseOption('date');
  const date = getDate(dateArg);
  
  // Determine leagues to process
  let leagues: League[] = [];
  
  if (leagueArg) {
    leagues = [leagueArg];
  } else if (sport) {
    leagues = providerFactory.getSupportedLeagues(sport);
  } else {
    console.error('Please specify --sport or --league');
    process.exit(1);
  }
  
  console.log(`\n📊 Generating projections for ${date}\n`);
  console.log('='.repeat(60));
  
  for (const league of leagues) {
    console.log(`\n🏀 ${league}:`);
    
    try {
      const projections = await projectionEngine.generateProjections(league, date);
      
      if (projections.length === 0) {
        console.log('   No games scheduled');
        continue;
      }
      
      for (const game of projections) {
        console.log(`\n   📍 ${game.homeTeam.teamName} vs ${game.awayTeam.teamName}`);
        console.log(`      Projected: ${game.homeTeam.projectedScore.toFixed(1)} - ${game.awayTeam.projectedScore.toFixed(1)}`);
        console.log(`      Players: ${game.players.length}`);
        
        // Show top player projections
        const topPlayers = game.players
          .filter(p => p.projectedStats.points || p.projectedStats.kills)
          .sort((a, b) => (b.projectedStats.points ?? b.projectedStats.kills ?? 0) - (a.projectedStats.points ?? a.projectedStats.kills ?? 0))
          .slice(0, 3);
        
        for (const player of topPlayers) {
          const mainStat = player.projectedStats.points ?? player.projectedStats.kills ?? 0;
          const statName = player.projectedStats.points ? 'pts' : 'kills';
          console.log(`         - ${player.playerName}: ${mainStat.toFixed(1)} ${statName}`);
        }
      }
    } catch (error: any) {
      console.error(`   Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

async function getEvents() {
  const sport = parseOption('sport')?.toLowerCase() as Sport | undefined;
  const leagueArg = parseOption('league')?.toUpperCase() as League | undefined;
  const dateArg = parseOption('date');
  const date = getDate(dateArg);
  const limit = parseInt(parseOption('limit') ?? '20', 10);
  
  let leagues: League[] = [];
  
  if (leagueArg) {
    leagues = [leagueArg];
  } else if (sport) {
    leagues = providerFactory.getSupportedLeagues(sport);
  } else {
    console.error('Please specify --sport or --league');
    process.exit(1);
  }
  
  console.log(`\n🎯 Top Events for ${date}\n`);
  console.log('='.repeat(80));
  
  for (const league of leagues) {
    console.log(`\n📊 ${league}:`);
    
    try {
      const projections = await projectionEngine.generateProjections(league, date);
      
      if (projections.length === 0) {
        console.log('   No games scheduled');
        continue;
      }
      
      // Generate mock lines for testing
      const lines = generateMockLines(projections, league);
      
      // Get reliability scores
      const sportType = providerFactory.getSportForLeague(league);
      const reliabilityScores = evaluationEngine.getReliabilityScores(sportType, league);
      
      // Find edges
      let events = edgeDetector.findEdges(projections, lines, reliabilityScores);
      events = edgeDetector.getTopEvents(events, limit);
      
      if (events.length === 0) {
        console.log('   No significant edges found');
        continue;
      }
      
      // Store events for later evaluation
      evaluationEngine.storeEvents(events);
      
      for (const event of events) {
        const arrow = event.direction === 'over' ? '↑' : '↓';
        console.log(`\n   ${arrow} ${event.playerName ?? event.teamName}`);
        console.log(`      Market: ${event.market}`);
        console.log(`      Line: ${event.line} | Projection: ${event.modelProjection}`);
        console.log(`      Direction: ${event.direction.toUpperCase()}`);
        console.log(`      Edge Score: ${event.edgeScore.toFixed(2)} | Probability: ${(event.probability * 100).toFixed(0)}%`);
        console.log(`      💡 ${event.reasoning}`);
      }
    } catch (error: any) {
      console.error(`   Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
}

async function runEvaluation() {
  const dateArg = parseOption('date');
  const date = getDate(dateArg);
  
  console.log(`\n📋 Evaluating predictions for ${date}\n`);
  console.log('='.repeat(60));
  
  try {
    const evaluated = await evaluationEngine.evaluateDate(date);
    
    if (evaluated.length === 0) {
      console.log('No predictions to evaluate for this date.');
      console.log('(Games may not have been completed yet)');
      return;
    }
    
    // Calculate summary
    const hits = evaluated.filter(e => e.result === 'hit').length;
    const misses = evaluated.filter(e => e.result === 'miss').length;
    const pushes = evaluated.filter(e => e.result === 'push').length;
    const voids = evaluated.filter(e => e.result === 'void').length;
    const decidedBets = hits + misses;
    const hitRate = decidedBets > 0 ? (hits / decidedBets) * 100 : 0;
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Evaluated: ${evaluated.length}`);
    console.log(`   ✅ Hits: ${hits}`);
    console.log(`   ❌ Misses: ${misses}`);
    console.log(`   ⚖️ Pushes: ${pushes}`);
    console.log(`   ⚫ Voids: ${voids}`);
    console.log(`   📈 Hit Rate: ${hitRate.toFixed(1)}%`);
    
    // Show individual results
    console.log(`\n📋 Details:`);
    for (const event of evaluated) {
      const emoji = event.result === 'hit' ? '✅' : event.result === 'miss' ? '❌' : '⚖️';
      console.log(`   ${emoji} ${event.playerName ?? event.teamName} | ${event.market}`);
      console.log(`      Line: ${event.line} | Actual: ${event.actualValue} | Projection: ${event.modelProjection}`);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
}

function showSummary() {
  const startDate = parseOption('start') ?? '2024-01-01';
  const endDate = parseOption('end') ?? new Date().toISOString().split('T')[0];
  
  console.log(`\n📊 Performance Summary (${startDate} to ${endDate})\n`);
  console.log('='.repeat(60));
  
  const summary = evaluationEngine.getSummary(startDate, endDate as string);
  
  console.log(`   Total Predictions: ${summary.total}`);
  console.log(`   ✅ Hits: ${summary.hits}`);
  console.log(`   ❌ Misses: ${summary.misses}`);
  console.log(`   ⚖️ Pushes: ${summary.pushes}`);
  console.log(`   ⚫ Voids: ${summary.voids}`);
  console.log(`   📈 Hit Rate: ${(summary.hitRate * 100).toFixed(1)}%`);
  console.log(`   📊 Average Edge: ${summary.averageEdge.toFixed(2)}`);
  
  console.log('\n' + '='.repeat(60));
}

function showReliability() {
  const sport = parseOption('sport')?.toLowerCase() as Sport | undefined;
  
  console.log(`\n📊 Reliability Report${sport ? ` (${sport})` : ''}\n`);
  console.log('='.repeat(80));
  
  const report = evaluationEngine.getReliabilityReport(sport);
  
  if (report.length === 0) {
    console.log('   No reliability data available yet.');
    console.log('   Run some evaluations first to build up history.');
    return;
  }
  
  console.log('\n   Market                | Total | Hits | Hit Rate');
  console.log('   ' + '-'.repeat(50));
  
  for (const score of report.slice(0, 20)) {
    const market = score.market.padEnd(20);
    const total = score.totalBets.toString().padStart(5);
    const hits = score.hits.toString().padStart(5);
    const hitRate = (score.hitRate * 100).toFixed(1).padStart(7) + '%';
    
    console.log(`   ${market} | ${total} | ${hits} | ${hitRate}`);
  }
  
  console.log('\n' + '='.repeat(80));
}

function showHelp() {
  console.log(`
SlipSmith CLI - Multi-Sport Projection Engine

Usage:
  npx ts-node src/cli.ts <command> [options]

Commands:
  generate    Generate projections for games
  events      Get top events (edges) for betting
  evaluate    Evaluate past predictions against actual results
  summary     Show overall performance summary
  reliability Show reliability scores by market

Options:
  --sport <sport>     Sport type (basketball, football, soccer, esports)
  --league <league>   Specific league (NBA, NFL, EPL, LOL, etc.)
  --date <date>       Date (YYYY-MM-DD, 'today', 'yesterday', 'tomorrow')
  --limit <n>         Limit number of results
  --mock              Use mock data instead of real APIs
  --start <date>      Start date for summary
  --end <date>        End date for summary

Examples:
  npx ts-node src/cli.ts generate --sport basketball --date today
  npx ts-node src/cli.ts events --league NBA --date today --limit 10
  npx ts-node src/cli.ts evaluate --date yesterday
  npx ts-node src/cli.ts summary --start 2024-01-01
  npx ts-node src/cli.ts reliability --sport basketball
`);
}

// Helper function to generate mock lines
function generateMockLines(projections: any[], league: League): any[] {
  const lines: any[] = [];
  
  for (const game of projections) {
    for (const player of game.players) {
      for (const [stat, value] of Object.entries(player.projectedStats)) {
        if (typeof value !== 'number') continue;
        
        const market = statToMarket(stat);
        if (!market) continue;
        
        const offset = (Math.random() - 0.5) * getMarketVariance(market);
        const line = Math.round((value + offset) * 2) / 2;
        
        lines.push({
          id: `${game.gameId}_${player.playerId}_${market}`,
          gameId: game.gameId,
          sport: game.sport,
          league: game.league,
          playerId: player.playerId,
          playerName: player.playerName,
          teamId: player.teamId,
          market,
          line,
          timestamp: new Date(),
        });
      }
    }
    
    for (const teamProjection of [game.homeTeam, game.awayTeam]) {
      lines.push({
        id: `${game.gameId}_${teamProjection.teamId}_TEAM_TOTAL`,
        gameId: game.gameId,
        sport: game.sport,
        league: game.league,
        teamId: teamProjection.teamId,
        teamName: teamProjection.teamName,
        market: 'TEAM_TOTAL',
        line: Math.round(teamProjection.projectedScore + (Math.random() - 0.5) * 6),
        timestamp: new Date(),
      });
    }
  }
  
  return lines;
}

function statToMarket(stat: string): string | null {
  const mapping: Record<string, string> = {
    'points': 'POINTS',
    'rebounds': 'REBOUNDS',
    'assists': 'ASSISTS',
    'threePointersMade': 'THREES',
    'passingYards': 'PASSING_YARDS',
    'rushingYards': 'RUSHING_YARDS',
    'receivingYards': 'RECEIVING_YARDS',
    'receptions': 'RECEPTIONS',
    'goals': 'GOALS',
    'kills': 'KILLS',
  };
  return mapping[stat] ?? null;
}

function getMarketVariance(market: string): number {
  const variances: Record<string, number> = {
    'POINTS': 4,
    'REBOUNDS': 2,
    'ASSISTS': 2,
    'THREES': 1,
    'PASSING_YARDS': 30,
    'RUSHING_YARDS': 20,
    'RECEIVING_YARDS': 20,
    'RECEPTIONS': 2,
    'GOALS': 0.5,
    'KILLS': 2,
  };
  return variances[market] ?? 1;
}

// Main
async function main() {
  try {
    switch (command) {
      case 'generate':
        await generateProjections();
        break;
      case 'events':
        await getEvents();
        break;
      case 'evaluate':
        await runEvaluation();
        break;
      case 'summary':
        showSummary();
        break;
      case 'reliability':
        showReliability();
        break;
      case 'help':
      case '--help':
      case '-h':
      default:
        showHelp();
    }
  } finally {
    evaluationEngine.close();
  }
}

main().catch(console.error);

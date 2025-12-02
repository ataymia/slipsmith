/**
 * SlipSmith Cloudflare Pages Function
 * 
 * This implements the same API endpoints as the Express server,
 * but runs as a Cloudflare Pages Function (Worker-style fetch handler).
 * 
 * Routes:
 *   GET  /api/health               - Health check
 *   GET  /api/sports               - Get supported sports and leagues
 *   GET  /api/schedule/:league/:date - Get schedule for a date
 *   GET  /api/projections/:league/:date - Generate projections
 *   GET  /api/events/:league/:date - Get top events (legacy format)
 *   GET  /api/top-events           - Get top events (SlipSmith format)
 *   POST /api/evaluate/:date       - Evaluate past predictions
 *   GET  /api/summary              - Get evaluation summary
 * 
 * Environment bindings are read from Cloudflare Pages environment variables.
 * Configure them in: Cloudflare Dashboard → Pages → Settings → Variables and Secrets
 */

import type { League, SlipTier } from '../projection-engine/src/types';

// Types for Cloudflare Pages Functions
interface Env {
  // Mode
  USE_MOCK_DATA?: string;
  
  // Firebase / Firestore
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  
  // Sports APIs
  BASKETBALL_API_KEY?: string;
  FOOTBALL_API_KEY?: string;
  SOCCER_API_KEY?: string;
  ESPORTS_API_KEY?: string;
  
  // Lines / Odds APIs
  ODDS_API_KEY?: string;
  LINES_API_KEY?: string;
  
  // Optional integrations
  OPENAI_API_KEY?: string;
  DISCORD_WEBHOOK_URL?: string;
  SLACK_WEBHOOK_URL?: string;
}

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
}

// Helper to create JSON response
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Helper to check mock mode
function isMockMode(env: Env): boolean {
  const useMockData = env.USE_MOCK_DATA;
  if (useMockData === undefined || useMockData === '' || useMockData === 'true') {
    return true;
  }
  return useMockData.toLowerCase() === 'true';
}

// Helper to get provider config
function getProviderConfig(env: Env) {
  return {
    basketballApiKey: env.BASKETBALL_API_KEY,
    footballApiKey: env.FOOTBALL_API_KEY,
    soccerApiKey: env.SOCCER_API_KEY,
    esportsApiKey: env.ESPORTS_API_KEY,
    useMockData: isMockMode(env),
  };
}

/**
 * Main request handler for the Cloudflare Pages Function
 */
export async function onRequest(context: Context): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  try {
    // Parse route
    const segments = path.split('/').filter(Boolean);
    
    // Health check: GET /api/health
    if (path === '/api/health' && method === 'GET') {
      return json({ 
        status: 'ok', 
        version: '1.0.0',
        runtime: 'cloudflare-pages-function',
        mockMode: isMockMode(env),
      });
    }
    
    // Get sports: GET /api/sports
    if (path === '/api/sports' && method === 'GET') {
      return await handleSports(env);
    }
    
    // Get schedule: GET /api/schedule/:league/:date
    if (segments[0] === 'api' && segments[1] === 'schedule' && segments.length === 4 && method === 'GET') {
      const league = segments[2] as League;
      const date = segments[3];
      return await handleSchedule(league, date, env);
    }
    
    // Generate projections: GET /api/projections/:league/:date
    if (segments[0] === 'api' && segments[1] === 'projections' && segments.length === 4 && method === 'GET') {
      const league = segments[2] as League;
      const date = segments[3];
      return await handleProjections(league, date, env);
    }
    
    // Get events (legacy): GET /api/events/:league/:date
    if (segments[0] === 'api' && segments[1] === 'events' && segments.length === 4 && method === 'GET') {
      const league = segments[2] as League;
      const date = segments[3];
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const minProbability = parseFloat(url.searchParams.get('minProbability') || '0.5');
      return await handleEvents(league, date, limit, minProbability, env);
    }
    
    // Get top events: GET /api/top-events
    if (path === '/api/top-events' && method === 'GET') {
      const date = url.searchParams.get('date');
      const sport = url.searchParams.get('sport');
      const tier = url.searchParams.get('tier') || 'starter';
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const minProbability = parseFloat(url.searchParams.get('minProbability') || '0.5');
      
      if (!date) {
        return json({ error: 'Missing required parameter: date (format: YYYY-MM-DD)' }, 400);
      }
      if (!sport) {
        return json({ error: 'Missing required parameter: sport (e.g., NBA, NFL)' }, 400);
      }
      
      return await handleTopEvents(date, sport, tier as SlipTier, limit, minProbability, env);
    }
    
    // Evaluate: POST /api/evaluate/:date
    if (segments[0] === 'api' && segments[1] === 'evaluate' && segments.length === 3 && method === 'POST') {
      const date = segments[2];
      return await handleEvaluate(date, env);
    }
    
    // Get summary: GET /api/summary
    if (path === '/api/summary' && method === 'GET') {
      const startDate = url.searchParams.get('startDate') || '2024-01-01';
      const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
      return await handleSummary(startDate, endDate, env);
    }
    
    // Not found
    return json({ error: 'Not found', path }, 404);
    
  } catch (error: any) {
    console.error('API Error:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, 500);
  }
}

// ============================================================================
// Handler Functions
// ============================================================================

async function handleSports(env: Env): Promise<Response> {
  // Define supported sports and leagues
  const sports = {
    basketball: ['NBA', 'WNBA'],
    football: ['NFL', 'NCAA_FB'],
    soccer: ['EPL', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1', 'MLS', 'UEFA_CL'],
    esports: ['LOL', 'CSGO', 'VALORANT', 'DOTA2'],
  };
  
  return json({ sports });
}

async function handleSchedule(league: League, date: string, env: Env): Promise<Response> {
  // In mock mode, return mock schedule
  const mockSchedule = {
    date,
    sport: getLeagueSport(league),
    league,
    games: generateMockGames(league, date, 3),
  };
  
  return json({ success: true, ...mockSchedule });
}

async function handleProjections(league: League, date: string, env: Env): Promise<Response> {
  const sport = getLeagueSport(league);
  
  // Generate mock projections
  const games = generateMockGames(league, date, 3).map(game => ({
    ...game,
    homeTeam: {
      teamId: game.homeTeam.id,
      teamName: game.homeTeam.name,
      gameId: game.id,
      sport,
      league,
      projectedScore: 100 + Math.round(Math.random() * 20),
      projectedStats: {},
      confidence: 0.75,
    },
    awayTeam: {
      teamId: game.awayTeam.id,
      teamName: game.awayTeam.name,
      gameId: game.id,
      sport,
      league,
      projectedScore: 95 + Math.round(Math.random() * 20),
      projectedStats: {},
      confidence: 0.75,
    },
    players: generateMockPlayers(game.id, game.homeTeam.id, game.awayTeam.id, sport, league),
    generatedAt: new Date(),
  }));
  
  let warning: string | undefined;
  if (isMockMode(env)) {
    warning = 'Using mock data for demonstration. Set USE_MOCK_DATA=false and configure API keys for live data.';
  }
  
  return json({
    success: true,
    date,
    sport,
    league,
    games,
    warning,
    generatedAt: new Date().toISOString(),
  });
}

async function handleEvents(
  league: League, 
  date: string, 
  limit: number, 
  minProbability: number, 
  env: Env
): Promise<Response> {
  const sport = getLeagueSport(league);
  
  // Generate mock events
  const events = generateMockEvents(league, date, sport, limit);
  
  return json({
    success: true,
    date,
    sport,
    league,
    events,
    totalEvents: events.length,
    generatedAt: new Date().toISOString(),
  });
}

async function handleTopEvents(
  date: string,
  sportQuery: string,
  tier: SlipTier,
  limit: number,
  minProbability: number,
  env: Env
): Promise<Response> {
  const league = sportQuery.toUpperCase() as League;
  const sport = getLeagueSport(league);
  
  if (!sport) {
    return json({ error: `Unknown sport/league: ${sportQuery}` }, 400);
  }
  
  // Generate mock events
  const events = generateMockEvents(league, date, sport, limit);
  
  // Convert to SlipSmith format
  const slipEvents = events.map(e => ({
    event_id: `${league.toLowerCase()}_${e.gameId}_${e.playerName?.toLowerCase().replace(/\s+/g, '_') || 'team'}_${e.market.toLowerCase()}${e.line.toString().replace('.', '_')}_${e.direction}_${date.replace(/-/g, '')}`,
    game_id: e.gameId,
    time: 'TBD',
    player: e.playerName || e.teamName || 'Unknown',
    team: e.teamName || '',
    market: e.market.toLowerCase().replace(/_/g, ' '),
    line: e.line,
    direction: e.direction,
    probability: `${Math.round(e.probability * 100)}%`,
    reasoning: e.reasoning,
  }));
  
  const slip = {
    slip_id: `${league}_${date.replace(/-/g, '_')}_${tier.toUpperCase()}`,
    date,
    sport: league,
    tier,
    warning: isMockMode(env) 
      ? 'Using mock data for demonstration. Connect real API providers for production use.'
      : undefined,
    events: slipEvents,
  };
  
  return json(slip);
}

async function handleEvaluate(date: string, env: Env): Promise<Response> {
  // Evaluation requires SQLite which isn't available in Workers
  return json({
    success: true,
    summary: {
      total: 0,
      hits: 0,
      misses: 0,
      pushes: 0,
      voids: 0,
      hitRate: 0,
    },
    warning: 'Evaluation is currently only available via the CLI in Node.js. Run: npm run evaluate',
  });
}

async function handleSummary(startDate: string, endDate: string, env: Env): Promise<Response> {
  return json({
    success: true,
    startDate,
    endDate,
    total: 0,
    hits: 0,
    misses: 0,
    pushes: 0,
    voids: 0,
    hitRate: 0,
    warning: isMockMode(env)
      ? 'Summary data is not available in mock mode. Connect Firebase for persistent evaluation tracking.'
      : undefined,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getLeagueSport(league: string): string {
  const leagueSportMap: Record<string, string> = {
    'NBA': 'basketball',
    'WNBA': 'basketball',
    'NFL': 'football',
    'NCAA_FB': 'football',
    'EPL': 'soccer',
    'LA_LIGA': 'soccer',
    'BUNDESLIGA': 'soccer',
    'SERIE_A': 'soccer',
    'LIGUE_1': 'soccer',
    'MLS': 'soccer',
    'UEFA_CL': 'soccer',
    'LOL': 'esports',
    'CSGO': 'esports',
    'VALORANT': 'esports',
    'DOTA2': 'esports',
  };
  return leagueSportMap[league] || 'basketball';
}

function generateMockGames(league: string, date: string, count: number): any[] {
  const teams = getMockTeams(league);
  const games: any[] = [];
  
  for (let i = 0; i < count && i * 2 + 1 < teams.length; i++) {
    games.push({
      id: `${league}_${date}_${i + 1}`,
      sport: getLeagueSport(league),
      league,
      homeTeam: teams[i * 2],
      awayTeam: teams[i * 2 + 1],
      startTime: new Date(`${date}T${19 + i}:00:00Z`),
      status: 'scheduled',
    });
  }
  
  return games;
}

function getMockTeams(league: string): any[] {
  const teamsByLeague: Record<string, any[]> = {
    'NBA': [
      { id: 'LAL', name: 'Los Angeles Lakers', abbreviation: 'LAL' },
      { id: 'BOS', name: 'Boston Celtics', abbreviation: 'BOS' },
      { id: 'PHX', name: 'Phoenix Suns', abbreviation: 'PHX' },
      { id: 'MIA', name: 'Miami Heat', abbreviation: 'MIA' },
      { id: 'GSW', name: 'Golden State Warriors', abbreviation: 'GSW' },
      { id: 'DEN', name: 'Denver Nuggets', abbreviation: 'DEN' },
    ],
    'NFL': [
      { id: 'KC', name: 'Kansas City Chiefs', abbreviation: 'KC' },
      { id: 'PHI', name: 'Philadelphia Eagles', abbreviation: 'PHI' },
      { id: 'SF', name: 'San Francisco 49ers', abbreviation: 'SF' },
      { id: 'BUF', name: 'Buffalo Bills', abbreviation: 'BUF' },
      { id: 'DAL', name: 'Dallas Cowboys', abbreviation: 'DAL' },
      { id: 'MIA', name: 'Miami Dolphins', abbreviation: 'MIA' },
    ],
  };
  
  return teamsByLeague[league] || teamsByLeague['NBA'];
}

function generateMockPlayers(gameId: string, homeTeamId: string, awayTeamId: string, sport: string, league: string): any[] {
  const playerNames = [
    'LeBron James', 'Anthony Davis', 'Austin Reaves', 'D\'Angelo Russell',
    'Jayson Tatum', 'Jaylen Brown', 'Derrick White', 'Kristaps Porzingis',
  ];
  
  return playerNames.slice(0, 6).map((name, i) => ({
    playerId: `player_${i + 1}`,
    playerName: name,
    teamId: i < 3 ? homeTeamId : awayTeamId,
    gameId,
    sport,
    league,
    position: ['PG', 'SG', 'SF', 'PF', 'C'][i % 5],
    projectedStats: {
      points: 15 + Math.round(Math.random() * 15),
      rebounds: 3 + Math.round(Math.random() * 7),
      assists: 2 + Math.round(Math.random() * 6),
    },
    confidence: 0.7 + Math.random() * 0.2,
    adjustments: [],
  }));
}

function generateMockEvents(league: string, date: string, sport: string, limit: number): any[] {
  const playerNames = [
    'LeBron James', 'Anthony Davis', 'Austin Reaves', 
    'Jayson Tatum', 'Jaylen Brown', 'Derrick White',
    'Kevin Durant', 'Devin Booker', 'Bradley Beal',
  ];
  
  const markets = ['POINTS', 'REBOUNDS', 'ASSISTS', 'THREES'];
  const events: any[] = [];
  
  for (let i = 0; i < Math.min(limit, playerNames.length); i++) {
    const market = markets[i % markets.length];
    const projection = 15 + Math.round(Math.random() * 15);
    const line = projection + (Math.random() - 0.5) * 6;
    const direction = projection > line ? 'over' : 'under';
    const edge = Math.abs(projection - line);
    
    events.push({
      eventId: `event_${date}_${i}`,
      date,
      sport,
      league,
      gameId: `${league}_${date}_${Math.floor(i / 3) + 1}`,
      playerId: `player_${i + 1}`,
      playerName: playerNames[i],
      teamId: `team_${i % 2 + 1}`,
      teamName: i % 2 === 0 ? 'Los Angeles Lakers' : 'Boston Celtics',
      market,
      line: Math.round(line * 2) / 2,
      direction,
      modelProjection: projection,
      probability: 0.55 + Math.random() * 0.3,
      edgeScore: edge,
      reasoning: `Strong ${direction} play based on recent performance and matchup analysis.`,
      confidence: 0.7 + Math.random() * 0.2,
    });
  }
  
  // Sort by edge score
  return events.sort((a, b) => b.edgeScore - a.edgeScore);
}

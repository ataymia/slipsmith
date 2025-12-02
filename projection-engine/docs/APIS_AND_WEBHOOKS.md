# APIs and Webhooks Documentation

This document lists all external APIs used by the SlipSmith Projection Engine, including setup instructions, alternatives, and webhook integration options.

## Table of Contents

1. [Basketball APIs](#basketball-apis)
2. [Football APIs](#football-apis)
3. [Soccer APIs](#soccer-apis)
4. [Esports APIs](#esports-apis)
5. [Consensus Lines APIs](#consensus-lines-apis)
6. [Webhooks](#webhooks)
7. [Environment Variables](#environment-variables)

---

## Basketball APIs

### Primary: ESPN API (Free)

ESPN provides a free, unofficial API that requires no authentication.

```
Base URL: https://site.api.espn.com/apis/site/v2/sports/basketball
```

**Endpoints Used:**
- `/nba/scoreboard` - Get schedule and scores
- `/nba/teams/{teamId}/roster` - Get team roster
- `/nba/injuries` - Get injury reports
- `/nba/summary?event={gameId}` - Get box scores

**Pros:**
- Free, no API key required
- Real-time data
- Reliable uptime

**Cons:**
- Unofficial (could change without notice)
- Rate limits unknown
- Limited historical data

### Secondary: balldontlie.io (Free tier)

```
Base URL: https://api.balldontlie.io/v1
```

**Setup:**
1. Sign up at https://www.balldontlie.io/
2. Get your free API key
3. Set `BASKETBALL_API_KEY` environment variable

**Endpoints:**
- `/games` - Get games by date
- `/stats` - Get player stats
- `/players` - Get player info
- `/teams` - Get team info

**Pros:**
- Official API with documentation
- Free tier: 60 requests/minute
- Historical data available

**Cons:**
- Rate limited on free tier
- No injury data

### Alternative: SportsData.io

Premium option with comprehensive NBA/WNBA coverage.

**Pricing:** Starts at $199/month

---

## Football APIs

### Primary: ESPN API (Free)

```
Base URL: https://site.api.espn.com/apis/site/v2/sports/football
```

**Endpoints:**
- `/nfl/scoreboard` - NFL schedule and scores
- `/college-football/scoreboard` - NCAA schedule
- `/nfl/teams/{teamId}/roster` - Roster
- `/nfl/injuries` - Injury reports
- `/nfl/summary?event={gameId}` - Box scores

### Alternative: MySportsFeeds

Comprehensive NFL data with free academic tier.

**Setup:**
1. Apply for free tier at https://www.mysportsfeeds.com/
2. Academic/personal use is free

**Endpoints:**
- `/nfl/{season}/games.json`
- `/nfl/{season}/player_stats_totals.json`
- `/nfl/{season}/player_injuries.json`

### Alternative: NFL Official API

Limited public access, primarily for apps.

---

## Soccer APIs

### Primary: ESPN API (Free)

```
Base URL: https://site.api.espn.com/apis/site/v2/sports/soccer
```

**League Codes:**
- `eng.1` - English Premier League
- `esp.1` - La Liga
- `ger.1` - Bundesliga
- `ita.1` - Serie A
- `fra.1` - Ligue 1
- `usa.1` - MLS
- `uefa.champions` - Champions League

### Alternative: API-Football (Free tier)

```
Base URL: https://v3.football.api-sports.io
```

**Setup:**
1. Sign up at https://www.api-football.com/
2. Get API key
3. Set `SOCCER_API_KEY` environment variable

**Free Tier:**
- 100 requests/day
- Access to most leagues

**Endpoints:**
- `/fixtures` - Matches
- `/players` - Player stats
- `/injuries` - Injuries
- `/odds` - Betting lines

### Alternative: Football-Data.org

Free tier with 10 requests/minute.

---

## Esports APIs

### Primary: PandaScore (Free tier)

```
Base URL: https://api.pandascore.co
```

**Setup:**
1. Sign up at https://pandascore.co/
2. Get API key
3. Set `ESPORTS_API_KEY` environment variable

**Supported Games:**
- League of Legends (`/lol`)
- Counter-Strike (`/csgo`)
- Valorant (`/valorant`)
- Dota 2 (`/dota2`)

**Free Tier:**
- 1,000 requests/hour

**Endpoints:**
- `/{game}/matches` - Matches
- `/{game}/teams` - Teams
- `/{game}/players` - Players
- `/{game}/leagues` - Leagues

### Alternative: Strafe.gg API

More limited but free.

### Alternative: HLTV API (CS only)

Unofficial, for Counter-Strike only.

---

## Consensus Lines APIs

### Option 1: The Odds API

```
Base URL: https://api.the-odds-api.com/v4
```

**Setup:**
1. Sign up at https://the-odds-api.com/
2. Get API key
3. Set `ODDS_API_KEY` environment variable

**Free Tier:**
- 500 requests/month

**Endpoints:**
- `/sports/{sport}/odds` - Get odds from multiple sportsbooks

**Sports Keys:**
- `basketball_nba`
- `americanfootball_nfl`
- `soccer_epl`

### Option 2: Action Network API

Premium option with more features.

### Option 3: Web Scraping

Build custom scrapers for DraftKings, FanDuel, etc.

---

## Webhooks

### Receiving Real-Time Updates

#### Option 1: ESPN PushPub (Unofficial)

ESPN uses Server-Sent Events for live updates.

```javascript
// Example connection
const es = new EventSource('https://site.api.espn.com/apis/v2/sports/basketball/nba/scoreboard?messageType=push');

es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle live score update
};
```

#### Option 2: Sportradar Push Feeds (Premium)

Sportradar offers push feeds for live data.

**Cost:** Enterprise pricing

#### Option 3: Polling with Caching

For free APIs, implement smart polling:

```javascript
// Poll every 5 minutes during off-hours
// Poll every 30 seconds during live games
const pollInterval = isLiveGame ? 30000 : 300000;

setInterval(async () => {
  const data = await fetchScores();
  if (hasChanged(data, cache)) {
    triggerUpdate(data);
    updateCache(data);
  }
}, pollInterval);
```

### Outbound Webhooks

Configure the engine to send updates:

```javascript
// In your config
const webhooks = {
  onProjectionsGenerated: 'https://your-server.com/webhooks/projections',
  onEventsFound: 'https://your-server.com/webhooks/events',
  onEvaluationComplete: 'https://your-server.com/webhooks/evaluation',
};
```

### Discord/Slack Integration

Send top events to Discord:

```javascript
async function sendToDiscord(events) {
  const embed = {
    title: '🎯 Today\'s Top Events',
    fields: events.slice(0, 10).map(e => ({
      name: `${e.playerName} - ${e.market}`,
      value: `Line: ${e.line} | Proj: ${e.modelProjection} | Edge: ${e.edgeScore.toFixed(2)}`,
    })),
  };
  
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
}
```

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# Server
PORT=3001
DB_PATH=./data/slipsmith.db

# Use mock data for testing (set to 'true' for testing without APIs)
USE_MOCK_DATA=false

# Basketball
BASKETBALL_API_KEY=your_balldontlie_api_key

# Football (ESPN doesn't require key)
FOOTBALL_API_KEY=

# Soccer
SOCCER_API_KEY=your_api_football_key

# Esports
ESPORTS_API_KEY=your_pandascore_api_key

# Betting Lines
ODDS_API_KEY=your_odds_api_key

# Webhooks (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Required vs Optional

| Variable | Required | Notes |
|----------|----------|-------|
| PORT | No | Defaults to 3001 |
| DB_PATH | No | Defaults to ./data/slipsmith.db |
| USE_MOCK_DATA | No | Set to 'true' for testing |
| BASKETBALL_API_KEY | No | ESPN is used as fallback |
| ESPORTS_API_KEY | Recommended | Mock data used without key |
| ODDS_API_KEY | Recommended | Mock lines used without key |

---

## Rate Limiting Best Practices

1. **Cache responses** - Store API responses for at least 5 minutes
2. **Use conditional requests** - Check ETags/Last-Modified headers
3. **Batch requests** - Fetch multiple resources in one call when possible
4. **Implement exponential backoff** - Wait longer after rate limit errors
5. **Monitor usage** - Track API calls to stay within limits

```javascript
// Example rate limiter
class RateLimiter {
  constructor(requestsPerMinute) {
    this.limit = requestsPerMinute;
    this.queue = [];
    this.processing = false;
  }
  
  async request(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }
  
  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      try {
        resolve(await fn());
      } catch (error) {
        reject(error);
      }
      await new Promise(r => setTimeout(r, 60000 / this.limit));
    }
    
    this.processing = false;
  }
}
```

# SlipSmith APIs and Keys Configuration

This document explains how to configure the SlipSmith projection engine to use real data APIs instead of mock data.

## Quick Start

### Running in Mock Mode (Default)

You can run SlipSmith in mock mode with no API keys at all:

```bash
cd projection-engine
cp .env.example .env
# Set USE_MOCK_DATA=true in .env (this is the default)
npm run dev
```

Then test the API:
```bash
curl "http://localhost:3001/api/top-events?date=2025-12-01&sport=NBA&tier=vip"
```

### Going Live with Real Data

**Good news!** The core schedule and injury APIs use **ESPN** which is **free and requires no API key**.

To use real data from external APIs:

1. **Set `USE_MOCK_DATA=false`** - This automatically enables ESPN for schedules and injuries

2. **Optional: Add API keys for enhanced features:**
   - `BASKETBALL_API_KEY` - For detailed NBA player stats from balldontlie.io
   - `ODDS_API_KEY` - For real betting lines (required for production)
   - `ESPORTS_API_KEY` - For esports data from PandaScore

---

## Data Sources Used

### ✅ ESPN API (Free, No Key Required)

The following data comes from ESPN's public API:

| Data Type | Endpoint | Sports Supported |
|-----------|----------|------------------|
| **Game Schedules** | `/scoreboard` | NBA, WNBA, NFL, NCAA Football, Soccer |
| **Injury Reports** | `/injuries` | NBA, WNBA, NFL, NCAA Football |
| **Team Rosters** | `/teams/{id}/roster` | All major sports |
| **Team Stats** | `/teams/{id}/statistics` | All major sports |
| **Player Gamelogs** | `/athletes/{id}/gamelog` | NFL, NCAA Football |

**No configuration needed** - Just set `USE_MOCK_DATA=false`.

### ⚡ balldontlie.io (Free Tier, Optional Key)

Enhanced NBA player statistics:

| Data Type | Endpoint | Notes |
|-----------|----------|-------|
| **Player Stats** | `/stats` | Historical game-by-game stats |
| **Player Averages** | `/season_averages` | Season averages |

**Environment Variable:**
- `BASKETBALL_API_KEY` - Optional, but recommended for higher rate limits

**Sign up:** https://www.balldontlie.io/

---

## Required API Categories

### 1. Schedule, Rosters, and Stats (ESPN - FREE)

**No configuration required!** ESPN endpoints are public.

The real providers automatically use:
- `https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/scoreboard`
- `https://site.api.espn.com/apis/site/v2/sports/football/{league}/scoreboard`
- `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard`

### 2. Injury Reports (ESPN - FREE)

**No configuration required!** Injury data comes from ESPN.

The real providers automatically use:
- `https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/injuries`
- `https://site.api.espn.com/apis/site/v2/sports/football/{league}/injuries`

**SlipSmith Injury Rules Applied:**
- **DNP Rule:** Never project players with status "OUT"
- **Usage Spikes:** Identify players who may see increased usage when stars are OUT
- **Confidence Penalty:** Apply penalties for Questionable (Q) and Doubtful (D) players

### 3. Odds/Props API (Required for Production)

**Purpose:** Fetch consensus betting lines and player prop markets.

**Environment Variables:**

| Variable | Description | Required |
|----------|-------------|----------|
| `ODDS_API_BASE_URL` | Base URL for the odds API | Yes (production) |
| `ODDS_API_KEY` | API key for authentication | Yes (production) |

**Example Configuration:**
```bash
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4
ODDS_API_KEY=your-odds-api-key
```

**Recommended Providers:**

| Provider | URL | Features |
|----------|-----|----------|
| The Odds API | https://the-odds-api.com | Multi-sport, multiple books |
| Pinnacle API | https://pinnacle.com | Sharp lines (requires account) |

**Line Integrity Rules:**
- Only create events for markets with lines from OddsProvider
- Never invent or fabricate lines
- If a user-provided line deviates >1.5 units from consensus, flag as "Inflated/High Risk"

---

## Environment Variables Summary

### Core Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_MOCK_DATA` | Use mock data instead of real APIs | `true` |
| `PORT` | Server port for API | `3001` |
| `DB_PATH` | Path to SQLite database | `./data/slipsmith.db` |

### Optional API Keys

| Variable | Description | Provider |
|----------|-------------|----------|
| `BASKETBALL_API_KEY` | NBA player stats (higher rate limits) | balldontlie.io |
| `ODDS_API_KEY` | Betting lines and props | The Odds API |
| `ODDS_API_BASE_URL` | Base URL for odds API | The Odds API |
| `ESPORTS_API_KEY` | Esports data | PandaScore |

---

## Example .env File

```bash
# ============================================================================
# SlipSmith Projection Engine Configuration
# ============================================================================

# Mode Configuration
USE_MOCK_DATA=false    # Set to 'false' to use real ESPN data (no key needed!)

# Server Configuration
PORT=3001
DB_PATH=./data/slipsmith.db

# ============================================================================
# Optional: Enhanced Basketball Stats (balldontlie.io)
# ============================================================================
# BASKETBALL_API_KEY=your-balldontlie-key-here

# ============================================================================
# Required for Production: Odds/Props API
# ============================================================================
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4
ODDS_API_KEY=your-odds-api-key-here

# ============================================================================
# Optional: Esports Data (PandaScore)
# ============================================================================
# ESPORTS_API_KEY=your-pandascore-key-here
```

---

## Provider Implementation Status

| Provider Type | Implementation | Data Source | Notes |
|---------------|----------------|-------------|-------|
| Schedule | ✅ **Production Ready** | ESPN (free) | No key required |
| Injury | ✅ **Production Ready** | ESPN (free) | No key required |
| Roster | ✅ **Production Ready** | ESPN (free) | No key required |
| Team Stats | ✅ **Production Ready** | ESPN (free) | No key required |
| Player Stats (NBA) | ✅ **Production Ready** | balldontlie.io | Optional key |
| Player Stats (Other) | ✅ **Production Ready** | ESPN (free) | No key required |
| Odds/Props | 🚧 Stub | Needs API key | Required for production |
| Esports | 🚧 Stub | PandaScore | Requires API key |

---

## Testing Your Configuration

### 1. Test Mock Mode

```bash
USE_MOCK_DATA=true npm run dev
curl "http://localhost:3001/api/top-events?date=2025-12-01&sport=NBA&tier=vip"
```

Expected: Returns slip with 30 NBA events from mock data.

### 2. Test Real Mode (ESPN - No Keys Needed!)

```bash
USE_MOCK_DATA=false npm run dev
curl "http://localhost:3001/api/top-events?date=$(date +%Y-%m-%d)&sport=NBA&tier=vip"
```

Expected: Returns slip with real events from ESPN.

### 3. Check Provider Status

When starting in real mode, the console will log provider status:

```
SlipSmith Provider Status:
  Stats API: ✓ Using ESPN (free)
  Odds API: ⚠ Not configured (using mock)
  Injury API: ✓ Using ESPN (free)
```

---

## Troubleshooting

### No Games Returned

- Check that the date is correct (YYYY-MM-DD format)
- Verify games are scheduled for that date (check ESPN.com)
- Some dates may have no games (off-season, etc.)

### Provider Falling Back to Mock

If you see "falling back to mock" warnings:
1. Ensure `USE_MOCK_DATA=false` is set
2. Check your internet connection
3. ESPN may be temporarily unavailable (rare)

### Rate Limiting

ESPN public APIs are generally reliable, but if you hit rate limits:
1. Add delays between requests
2. Cache responses when possible
3. Consider adding `BASKETBALL_API_KEY` for balldontlie.io to offload NBA stats

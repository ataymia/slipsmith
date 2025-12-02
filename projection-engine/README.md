# SlipSmith Projection Engine

🎯 **Multi-Sport Projection Brain for NBA, NFL, Soccer & Esports**

A full-featured projection engine that generates box score projections, identifies high-edge betting opportunities, and learns from historical performance.

## Features

- **Multi-Sport Support**: NBA, WNBA, NFL, Soccer (EPL, La Liga, etc.), and Esports (LoL, CS2)
- **Full Box Score Projections**: Team and player-level projections for every game
- **Edge Detection**: Automatically finds misaligned lines with probability scoring
- **Self-Learning**: Tracks predictions, evaluates results, and updates reliability scores
- **REST API**: Full API for integration with other tools
- **Testing UI**: Built-in frontend for testing and visualization

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Navigate to projection-engine directory
cd projection-engine

# Install dependencies
npm install

# Create data directory
mkdir -p data

# Copy environment file
cp .env.example .env
```

### Configuration

Edit `.env` with your API keys (optional - uses mock data without keys):

```bash
# Server
PORT=3001
DB_PATH=./data/slipsmith.db

# Use mock data for testing (set to 'true' for testing without APIs)
USE_MOCK_DATA=false

# API Keys (optional)
BASKETBALL_API_KEY=your_balldontlie_key
ESPORTS_API_KEY=your_pandascore_key
ODDS_API_KEY=your_odds_api_key
```

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The API will be available at `http://localhost:3001`

### Using the Frontend

Open `frontend/index.html` in your browser to access the testing UI.

---

## CLI Usage

### Generate Projections

```bash
# Generate projections for NBA today
npm run generate:nba

# Or using ts-node directly
npx ts-node src/cli.ts generate --sport basketball --date today

# For specific league and date
npx ts-node src/cli.ts generate --league NBA --date 2024-01-15

# Using mock data
npx ts-node src/cli.ts generate --sport basketball --mock
```

### Get Top Events (Edges)

```bash
# Get top events for NFL
npm run events:nfl

# With options
npx ts-node src/cli.ts events --league NBA --date today --limit 10
```

### Run Evaluation

```bash
# Evaluate yesterday's predictions
npm run evaluate

# Specific date
npx ts-node src/cli.ts evaluate --date 2024-01-14
```

### View Summary

```bash
# Overall performance summary
npx ts-node src/cli.ts summary

# With date range
npx ts-node src/cli.ts summary --start 2024-01-01 --end 2024-01-31
```

### Reliability Report

```bash
# View reliability scores
npx ts-node src/cli.ts reliability --sport basketball
```

---

## API Endpoints

### Health Check

```
GET /health
```

### Get Supported Sports

```
GET /api/sports
```

Response:
```json
{
  "sports": {
    "basketball": ["NBA", "WNBA"],
    "football": ["NFL", "NCAA_FB"],
    "soccer": ["EPL", "LA_LIGA", ...],
    "esports": ["LOL", "CSGO", ...]
  }
}
```

### Get Schedule

```
GET /api/schedule/:league/:date
```

Example:
```bash
curl http://localhost:3001/api/schedule/NBA/2024-01-15
```

### Generate Projections

```
GET /api/projections/:league/:date
```

Example:
```bash
curl http://localhost:3001/api/projections/NBA/2024-01-15
```

Response:
```json
{
  "success": true,
  "date": "2024-01-15",
  "sport": "basketball",
  "league": "NBA",
  "games": [
    {
      "gameId": "game_123",
      "homeTeam": { "teamName": "Warriors", "projectedScore": 118.5, ... },
      "awayTeam": { "teamName": "Lakers", "projectedScore": 112.3, ... },
      "players": [
        { "playerName": "Stephen Curry", "projectedStats": { "points": 28.5, ... } }
      ]
    }
  ]
}
```

### Get Top Events

```
GET /api/events/:league/:date?limit=20&minProbability=0.5
```

Example:
```bash
curl "http://localhost:3001/api/events/NBA/2024-01-15?limit=10"
```

Response:
```json
{
  "success": true,
  "events": [
    {
      "eventId": "evt_123",
      "playerName": "Stephen Curry",
      "market": "POINTS",
      "line": 27.5,
      "direction": "over",
      "modelProjection": 31.2,
      "probability": 0.72,
      "edgeScore": 6.8,
      "reasoning": "Curry projects to 31.2 points..."
    }
  ]
}
```

### Get Top Events (SlipSmith Export Format)

**This is the preferred endpoint for external consumers.**

```
GET /api/top-events?date=YYYY-MM-DD&sport=NBA&tier=vip
```

Parameters:
- `date` (required): Date in YYYY-MM-DD format
- `sport` (required): Sport/league identifier (e.g., "NBA", "NFL")
- `tier` (optional): "starter", "pro", or "vip" (default: "starter")
- `limit` (optional): Maximum events to return (default: 20)
- `minProbability` (optional): Minimum probability filter 0-1 (default: 0.5)

Example:
```bash
curl "http://localhost:3001/api/top-events?date=2024-01-15&sport=NBA&tier=vip"
```

Response:
```json
{
  "slip_id": "NBA_2024_01_15_VIP",
  "date": "2024-01-15",
  "sport": "NBA",
  "tier": "vip",
  "events": [
    {
      "event_id": "nba_game_123_curry_points27_5_over_20240115",
      "game_id": "game_123",
      "time": "TBD",
      "player": "Stephen Curry",
      "team": "Warriors",
      "market": "points",
      "line": 27.5,
      "direction": "over",
      "probability": "72%",
      "reasoning": "Stephen Curry projected for 31.2 points, line set at 27.5. Strong over opportunity with 3.7 unit edge."
    }
  ]
}
```

**Note:** The `probability` field is a string with `%` suffix in this format.
```

### Run Evaluation

```
POST /api/evaluate/:date
```

Example:
```bash
curl -X POST http://localhost:3001/api/evaluate/2024-01-14
```

### Get Summary

```
GET /api/summary?startDate=2024-01-01&endDate=2024-01-31
```

### Get Reliability Report

```
GET /api/reliability?sport=basketball
```

---

## Project Structure

```
projection-engine/
├── src/
│   ├── api/          # Express server and routes
│   ├── engine/       # Projection and edge detection logic
│   ├── evaluation/   # Learning and evaluation system
│   ├── providers/    # Sport-specific data providers
│   ├── types/        # TypeScript type definitions
│   ├── cli.ts        # Command-line interface
│   └── index.ts      # Main entry point
├── frontend/         # Testing UI
├── docs/             # Documentation
│   ├── APIS_AND_WEBHOOKS.md
│   ├── ARCHITECTURE.md
│   ├── LEARNING_AND_EVAL.md
│   ├── AI_INTEGRATION.md
│   └── NEXT_STEPS_AND_HOOKS.md
├── data/             # SQLite database (gitignored)
└── tests/            # Test files
```

---

## Documentation

- [APIs and Webhooks](docs/APIS_AND_WEBHOOKS.md) - External API providers and integration
- [Architecture](docs/ARCHITECTURE.md) - System design and projection methodology
- [Learning and Evaluation](docs/LEARNING_AND_EVAL.md) - Self-learning system documentation
- [AI Integration](docs/AI_INTEGRATION.md) - Using AI for reasoning and explanation
- [Firebase Integration](docs/FIREBASE_INTEGRATION.md) - Firestore storage for projections, results, and slips
- [Next Steps](docs/NEXT_STEPS_AND_HOOKS.md) - Roadmap and future enhancements

---

## Firebase Integration

The projection engine integrates with the SlipSmith Firebase project for persistent storage of projections, results, slips, and reliability data.

### Quick Setup

1. **Set Environment Variables**:
   ```bash
   # Required
   FIREBASE_PROJECT_ID=your-project-id
   
   # For Node.js (local development)
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   
   # For Cloudflare Workers
   FIREBASE_API_KEY=your-web-api-key
   ```

2. **Initialize in Code**:
   ```typescript
   import { initializeFirebase, saveSlip } from './services/slipsmithFirebase';
   
   await initializeFirebase();
   
   // Save a slip to Firestore
   await saveSlip({
     slip_id: 'NBA_2025_12_01_VIP',
     date: '2025-12-01',
     sport: 'NBA',
     tier: 'vip',
     events: [...],
   });
   ```

### Cloudflare Compatibility

The Firebase module is designed to work on Cloudflare Pages/Workers:

- **Browser**: Uses `window.db` from the main app's Firebase SDK
- **Cloudflare Workers**: Uses Firestore REST API (no Admin SDK dependency)
- **Node.js**: Uses Firebase Admin SDK when available

See [Firebase Integration Guide](docs/FIREBASE_INTEGRATION.md) for full documentation.

---

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

---

## Example Workflows

### Daily Operations

```bash
# Morning: Generate today's projections
npx ts-node src/cli.ts generate --sport basketball --date today

# Morning: Get top events
npx ts-node src/cli.ts events --sport basketball --date today --limit 20

# Next day: Evaluate yesterday's predictions
npx ts-node src/cli.ts evaluate --date yesterday

# Weekly: Review performance
npx ts-node src/cli.ts summary --start 2024-01-01
```

### Integration with Slipsmith Admin

The projection engine can feed into the main SlipSmith admin tool:

1. Generate projections via API
2. Get top events formatted as slip JSON
3. Post to content feed via admin tool

### Programmatic Usage

```typescript
import { getTopEvents, SlipService } from 'slipsmith-projection-engine';

// Quick usage with factory function
const slip = await getTopEvents({
  date: '2025-12-01',
  sport: 'NBA',
  tier: 'vip',
  limit: 10,
});

console.log(JSON.stringify(slip, null, 2));

// Or with full service for multiple calls
const service = new SlipService({
  providerConfig: { useMockData: true },
});

const nbaSlip = await service.getTopEvents({
  date: '2025-12-01',
  sport: 'NBA',
  tier: 'vip',
});

const nflSlip = await service.getTopEvents({
  date: '2025-12-01',
  sport: 'NFL',
  tier: 'pro',
});

// Clean up when done
service.close();
```

---

## Disclaimer

This tool is for educational and analytical purposes only. It does not provide betting advice, and past performance does not guarantee future results. Please gamble responsibly.

---

## License

ISC

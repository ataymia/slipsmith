# Architecture Documentation

This document explains the architecture of the SlipSmith Projection Engine, how projections are computed, and how to extend the system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Projection Methodology](#projection-methodology)
5. [Sport-Specific Logic](#sport-specific-logic)
6. [Extending the System](#extending-the-system)
7. [Future Enhancements](#future-enhancements)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SlipSmith Projection Engine                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────┐    │
│  │   Data      │───▶│   Projection    │───▶│   Edge Detection     │    │
│  │  Providers  │    │     Engine      │    │      System          │    │
│  └─────────────┘    └─────────────────┘    └──────────────────────┘    │
│         │                   │                        │                  │
│         │                   │                        │                  │
│  ┌──────▼──────┐    ┌───────▼───────┐    ┌──────────▼───────────┐     │
│  │  External   │    │   Historical  │    │    Evaluation        │     │
│  │    APIs     │    │    Database   │    │    & Learning        │     │
│  └─────────────┘    └───────────────┘    └──────────────────────┘     │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         REST API Server                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Frontend UI / CLI                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Data Providers (`src/providers/`)

Abstract layer for fetching sports data from various APIs.

```
BaseDataProvider (abstract)
├── BasketballProvider (NBA, WNBA)
├── FootballProvider (NFL, NCAA)
├── SoccerProvider (EPL, La Liga, etc.)
├── EsportsProvider (LoL, CS2, etc.)
└── MockDataProvider (for testing)
```

**Key Interface:**
```typescript
interface DataProvider {
  sport: Sport;
  supportedLeagues: League[];
  
  getSchedule(league: League, date: string): Promise<Schedule>;
  getTeamRoster(teamId: string): Promise<Player[]>;
  getPlayerStats(playerId: string, numGames?: number): Promise<PlayerStats[]>;
  getTeamStats(teamId: string, numGames?: number): Promise<Record<string, number>>;
  getInjuryReport(league: League): Promise<Player[]>;
  getGameBoxScore(gameId: string): Promise<BoxScore | null>;
}
```

### 2. Projection Engine (`src/engine/ProjectionEngine.ts`)

Core logic for generating projections.

```typescript
class ProjectionEngine {
  generateProjections(league: League, date: string): Promise<GameProjection[]>;
  projectGame(game: Game, injuryMap: Map): Promise<GameProjection>;
  projectTeam(team: Team, game: Game, stats: TeamStats): TeamProjection;
  projectPlayer(player: Player, stats: PlayerStats[]): PlayerProjection;
}
```

### 3. Edge Detector (`src/engine/EdgeDetector.ts`)

Compares projections to consensus lines and identifies value.

```typescript
class EdgeDetector {
  findEdges(projections: GameProjection[], lines: ConsensusLine[]): Event[];
  calculateProbability(edge: number, threshold: number): number;
  calculateEdgeScore(factors: EdgeFactors): number;
  generateReasoning(event: Event, projection: PlayerProjection): string;
}
```

### 4. Evaluation Engine (`src/evaluation/EvaluationEngine.ts`)

Tracks predictions and learns from results.

```typescript
class EvaluationEngine {
  storeEvents(events: Event[]): void;
  evaluateDate(date: string): Promise<EvaluatedEvent[]>;
  updateReliability(prediction: Prediction, result: Result): void;
  getReliabilityScores(sport?: Sport): Map<string, number>;
}
```

### 5. API Server (`src/api/server.ts`)

Express server exposing REST endpoints.

```
GET  /health
GET  /api/sports
GET  /api/schedule/:league/:date
GET  /api/projections/:league/:date
GET  /api/events/:league/:date
POST /api/evaluate/:date
GET  /api/summary
GET  /api/reliability
```

---

## Data Flow

### 1. Projection Generation Flow

```
User Request (/api/projections/NBA/2024-01-15)
    │
    ▼
ProviderFactory.getProviderForLeague('NBA')
    │
    ▼
BasketballProvider.getSchedule()
    │
    ├── Games for date
    │
    ▼
For each game:
    │
    ├── getTeamRoster(homeTeam)
    ├── getTeamRoster(awayTeam)
    ├── getTeamStats(homeTeam)
    ├── getTeamStats(awayTeam)
    ├── getInjuryReport()
    │
    ▼
ProjectionEngine.projectGame()
    │
    ├── projectTeam(homeTeam)
    ├── projectTeam(awayTeam)
    │
    └── For each player:
        │
        ├── getPlayerStats(playerId)
        ├── calculateWeightedStats()
        ├── applyAdjustments()
        │
        └── PlayerProjection
    │
    ▼
GameProjection[]
```

### 2. Edge Detection Flow

```
GameProjection[] + ConsensusLine[]
    │
    ▼
EdgeDetector.findEdges()
    │
    ├── For each line:
    │   │
    │   ├── Find matching projection
    │   ├── Calculate edge (projection - line)
    │   ├── Calculate probability
    │   ├── Get reliability score
    │   ├── Calculate edge score
    │   └── Generate reasoning
    │
    ▼
Event[] (sorted by edge score)
```

### 3. Evaluation Flow

```
POST /api/evaluate/2024-01-14
    │
    ▼
EvaluationEngine.evaluateDate()
    │
    ├── Get stored projections for date
    │
    ├── For each game:
    │   │
    │   ├── getGameBoxScore(gameId)
    │   │
    │   └── For each projection:
    │       │
    │       ├── Get actual stat value
    │       ├── Determine result (hit/miss/push/void)
    │       ├── Store evaluation
    │       └── Update reliability scores
    │
    ▼
EvaluatedEvent[] + Updated reliability
```

---

## Projection Methodology

### Current Model: Weighted Historical Averages

The current projection model uses a straightforward approach:

1. **Historical Averaging**
   - Fetch last N games (default: 10)
   - Apply recency weighting (recent games count more)
   - Calculate weighted average for each stat

2. **Adjustments Applied:**
   - **Injury Status**: Confidence penalty based on injury designation
   - **Home/Away**: 3% adjustment for home advantage
   - **Rest Days**: (Planned) Adjustment for back-to-backs
   - **Matchup**: (Planned) Adjustment based on opponent

### Adjustment Factors

```typescript
// Injury penalties
const injuryPenalties = {
  'healthy': 1.0,
  'probable': 0.98,
  'day-to-day': 0.85,
  'questionable': 0.65,
  'doubtful': 0.30,
  'out': 0,
};

// Home advantage
const homeAdvantage = 1.03; // 3% boost
```

### Edge Score Calculation

```typescript
edgeScore = (
  normalizedEdge * 0.5 +     // How much projection differs from line
  confidence * 0.3 +          // Model confidence in projection
  reliability * 0.2           // Historical accuracy for this bet type
) * 10;
```

### Probability Estimation

Uses error function approximation for normal distribution:

```typescript
// Z-score based on edge and threshold
const zScore = edge / marketThreshold;
const probability = 0.5 + 0.5 * erf(zScore / sqrt(2));
```

---

## Sport-Specific Logic

### Basketball (NBA/WNBA)

**Key Stats:**
- Points, Rebounds, Assists, Steals, Blocks
- Three-pointers made
- Combos: PRA, PR, PA, RA, Stocks

**Special Considerations:**
- Pace adjustment (faster pace = more counting stats)
- Back-to-back games
- Load management/rest

### Football (NFL)

**Key Stats:**
- Passing: Yards, TDs, Interceptions
- Rushing: Yards, TDs, Carries
- Receiving: Yards, TDs, Receptions

**Special Considerations:**
- Weather impact
- Game script (winning team runs more)
- Opponent pass/run defense

### Soccer

**Key Stats:**
- Goals, Assists
- Shots, Shots on Target
- Tackles, Interceptions

**Special Considerations:**
- Home/away splits more significant
- International vs domestic form
- Cup vs league priorities

### Esports

**Key Stats:**
- Kills, Deaths, Assists
- CS (Creep Score), Gold
- Damage dealt

**Special Considerations:**
- Meta changes
- Roster changes
- Tournament format (Bo1 vs Bo3)

---

## Extending the System

### Adding a New Sport

1. **Create Provider** (`src/providers/NewSportProvider.ts`):

```typescript
import { BaseDataProvider } from './BaseProvider';

export class NewSportProvider extends BaseDataProvider {
  sport: Sport = 'newsport';
  supportedLeagues: League[] = ['LEAGUE1', 'LEAGUE2'];
  
  async getSchedule(league: League, date: string): Promise<Schedule> {
    // Implement API calls
  }
  
  // Implement other required methods
}
```

2. **Add Types** (`src/types/index.ts`):

```typescript
// Add to League type
export type League = 'NBA' | 'WNBA' | ... | 'NEW_LEAGUE';

// Add stat interface
export interface NewSportPlayerStats extends BasePlayerStats {
  customStat1: number;
  customStat2: number;
}
```

3. **Register Provider** (`src/providers/index.ts`):

```typescript
import { NewSportProvider } from './NewSportProvider';

// In ProviderFactory.initializeProviders()
this.providers.set('newsport', new NewSportProvider(config.newSportApiKey));
```

4. **Update Projection Engine** (if needed):

```typescript
// In calculateWeightedStats()
case 'newsport':
  return ['customStat1', 'customStat2', ...];
```

### Adding a New Market Type

1. **Add to Types:**

```typescript
export type MarketType = ... | 'NEW_MARKET';
```

2. **Update EdgeDetector:**

```typescript
// In marketToStatKey()
'NEW_MARKET': 'statKey',

// In marketThresholds
'NEW_MARKET': 2.0, // Edge threshold
```

### Swapping the Model

The projection model is encapsulated in `ProjectionEngine`. To swap:

1. **Create new engine:**

```typescript
class MLProjectionEngine extends ProjectionEngine {
  async generateProjections(league: League, date: string) {
    // Use ML model instead
  }
}
```

2. **Configure in API:**

```typescript
const projectionEngine = process.env.USE_ML 
  ? new MLProjectionEngine(providerFactory)
  : new ProjectionEngine(providerFactory);
```

---

## Future Enhancements

### Phase 1: Model Improvements

- [ ] **Matchup adjustments** - Factor in opponent defense
- [ ] **Pace/tempo modeling** - Game-specific pace factors
- [ ] **Rest day analysis** - Adjust for back-to-backs
- [ ] **Usage rate tracking** - Increase projections when key players out

### Phase 2: ML Integration

- [ ] **Feature engineering** - Create rich feature set
- [ ] **Train regression models** - Per-stat prediction models
- [ ] **Ensemble methods** - Combine multiple models
- [ ] **Real-time updates** - In-game projection adjustments

### Phase 3: Advanced Features

- [ ] **Monte Carlo simulation** - Run 1000s of simulations
- [ ] **Correlation analysis** - Identify correlated bets
- [ ] **Optimal bet sizing** - Kelly criterion integration
- [ ] **Portfolio optimization** - Diversification across bets

### Phase 4: Infrastructure

- [ ] **Redis caching** - Cache API responses
- [ ] **Queue system** - Handle batch processing
- [ ] **Horizontal scaling** - Multiple projection workers
- [ ] **Real-time streaming** - Live projection updates

---

## Directory Structure

```
projection-engine/
├── src/
│   ├── api/
│   │   ├── server.ts        # Express server
│   │   └── index.ts
│   ├── engine/
│   │   ├── ProjectionEngine.ts
│   │   ├── EdgeDetector.ts
│   │   └── index.ts
│   ├── evaluation/
│   │   ├── EvaluationEngine.ts
│   │   └── index.ts
│   ├── providers/
│   │   ├── BaseProvider.ts
│   │   ├── BasketballProvider.ts
│   │   ├── FootballProvider.ts
│   │   ├── SoccerProvider.ts
│   │   ├── EsportsProvider.ts
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── cli.ts               # CLI tool
│   └── index.ts             # Main entry point
├── frontend/
│   └── index.html           # Test UI
├── docs/
│   ├── APIS_AND_WEBHOOKS.md
│   ├── ARCHITECTURE.md
│   ├── LEARNING_AND_EVAL.md
│   ├── AI_INTEGRATION.md
│   └── NEXT_STEPS_AND_HOOKS.md
├── data/                    # SQLite database (gitignored)
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

# Next Steps and Hooks

This document outlines the roadmap for extending SlipSmith, including recommended APIs, webhook integrations, and scaling strategies.

## Table of Contents

1. [Recommended APIs by Sport](#recommended-apis-by-sport)
2. [Webhook Integrations](#webhook-integrations)
3. [Adding More Sports](#adding-more-sports)
4. [Model Sophistication](#model-sophistication)
5. [Scaling Strategies](#scaling-strategies)
6. [Roadmap](#roadmap)

---

## Recommended APIs by Sport

### Basketball (NBA/WNBA)

| Provider | Tier | Cost | Best For |
|----------|------|------|----------|
| **ESPN API** | Free | $0 | Schedule, scores, injuries |
| **balldontlie.io** | Free/Paid | $0-$60/mo | Historical stats |
| **NBA Stats API** | Free | $0 | Advanced metrics, official data |
| **SportsData.io** | Paid | $199/mo+ | Commercial applications |
| **Sportradar** | Enterprise | Custom | Live data, odds feeds |

**Recommended Stack:**
- ESPN for schedules and live data
- balldontlie for historical player stats
- NBA Stats API for advanced metrics (pace, usage, etc.)

### Football (NFL)

| Provider | Tier | Cost | Best For |
|----------|------|------|----------|
| **ESPN API** | Free | $0 | Schedule, scores, injuries |
| **MySportsFeeds** | Free/Paid | $0-$199/mo | Comprehensive data |
| **nflverse** | Free | $0 | Play-by-play, analytics |
| **SportsData.io** | Paid | $199/mo+ | Commercial applications |

**Recommended Stack:**
- ESPN for schedules and injuries
- nflverse for advanced analytics
- MySportsFeeds for projections data

### Soccer

| Provider | Tier | Cost | Best For |
|----------|------|------|----------|
| **ESPN API** | Free | $0 | Major leagues, basic data |
| **API-Football** | Free/Paid | $0-$100/mo | Comprehensive global data |
| **Football-Data.org** | Free | $0 | European leagues |
| **Opta/Stats Perform** | Enterprise | Custom | Premium analytics |

**Recommended Stack:**
- ESPN for major leagues
- API-Football for comprehensive coverage
- Football-Data.org as backup

### Esports

| Provider | Tier | Cost | Best For |
|----------|------|------|----------|
| **PandaScore** | Free/Paid | $0-$99/mo | Multi-game coverage |
| **HLTV** | Free | $0 | Counter-Strike only |
| **Liquipedia** | Free | $0 | LoL, Dota 2, SC2 |
| **Riot API** | Free | $0 | Official LoL data |

**Recommended Stack:**
- PandaScore for matches and odds
- Official game APIs (Riot, Valve) for player stats
- Liquipedia for historical/contextual data

### Betting Lines

| Provider | Tier | Cost | Best For |
|----------|------|------|----------|
| **The Odds API** | Free/Paid | $0-$149/mo | Multi-book odds |
| **Action Network** | Paid | Custom | Line movement, consensus |
| **Pinnacle API** | Paid | Custom | Sharp lines |
| **Book-specific APIs** | Varies | Varies | Direct feeds |

---

## Webhook Integrations

### Receiving Real-Time Data

#### 1. Injury Updates

```typescript
// Example: Webhook receiver for injury updates
app.post('/webhooks/injuries', async (req, res) => {
  const { player, team, status, notes, timestamp } = req.body;
  
  // Validate signature
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Update projection confidence
  await updatePlayerInjuryStatus(player.id, status);
  
  // Regenerate affected projections
  const affectedGames = await getGamesForPlayer(player.id);
  for (const game of affectedGames) {
    await regenerateProjection(game.id);
  }
  
  // Notify downstream systems
  await notifyClients('injury_update', { player, status });
  
  res.status(200).send('OK');
});
```

#### 2. Lineup Confirmations

```typescript
// Triggered when starting lineups are announced
app.post('/webhooks/lineups', async (req, res) => {
  const { game_id, home_lineup, away_lineup, timestamp } = req.body;
  
  // Update player projections based on confirmed starters
  for (const player of [...home_lineup, ...away_lineup]) {
    await confirmPlayerStarting(player.id, game_id);
  }
  
  // Regenerate game projection
  await regenerateProjection(game_id);
  
  res.status(200).send('OK');
});
```

#### 3. Live Score Updates

```typescript
// Real-time game updates
app.post('/webhooks/scores', async (req, res) => {
  const { game_id, quarter, home_score, away_score, events } = req.body;
  
  // Update live projections (in-game model)
  await updateLiveProjection(game_id, {
    quarter,
    home_score,
    away_score,
  });
  
  // Check for notable events (injury during game, ejection, etc.)
  for (const event of events) {
    if (event.type === 'injury' || event.type === 'ejection') {
      await handleInGameEvent(game_id, event);
    }
  }
  
  res.status(200).send('OK');
});
```

#### 4. Final Box Scores

```typescript
// Triggered when game ends
app.post('/webhooks/final', async (req, res) => {
  const { game_id, box_score, final } = req.body;
  
  if (!final) {
    return res.status(400).send('Game not final');
  }
  
  // Trigger evaluation
  await evaluateGamePredictions(game_id, box_score);
  
  // Update reliability scores
  await updateReliabilityFromGame(game_id);
  
  res.status(200).send('OK');
});
```

### Outbound Webhooks

Configure SlipSmith to push updates to your systems:

```typescript
// src/config/webhooks.ts

export const webhookConfig = {
  // Trigger when new projections are generated
  onProjectionsGenerated: {
    url: process.env.WEBHOOK_PROJECTIONS_URL,
    events: ['projections.created', 'projections.updated'],
  },
  
  // Trigger when high-edge events are found
  onHighEdgeEvents: {
    url: process.env.WEBHOOK_EVENTS_URL,
    events: ['events.high_edge'],
    filter: { minEdgeScore: 7.0 },
  },
  
  // Trigger on evaluation complete
  onEvaluationComplete: {
    url: process.env.WEBHOOK_EVALUATION_URL,
    events: ['evaluation.complete'],
  },
};

// Webhook dispatcher
async function dispatchWebhook(event: string, payload: any) {
  const configs = getWebhookConfigsForEvent(event);
  
  for (const config of configs) {
    try {
      await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(payload, config.secret),
        },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      });
    } catch (error) {
      console.error(`Webhook failed for ${event}:`, error);
    }
  }
}
```

---

## Adding More Sports

### Phase 1: Additional Leagues

**Easy additions (same sport category):**

- **Basketball:** Euroleague, G-League, Australian NBL
- **Football:** CFL, XFL, Arena Football
- **Soccer:** Serie A, MLS, Liga MX, Championship
- **Esports:** Overwatch, Rainbow Six, Rocket League

**Implementation time:** 1-2 days per league

### Phase 2: New Sports

**Medium complexity:**

- **Baseball (MLB)** - Similar structure to other US sports
- **Hockey (NHL)** - Similar to basketball/football
- **Tennis** - Player-vs-player requires different model
- **Golf** - Tournament format, many players

**Implementation time:** 1-2 weeks per sport

### Phase 3: Niche Sports

**Higher complexity:**

- **UFC/MMA** - Fight-by-fight, many variables
- **Cricket** - Multiple formats, different markets
- **Horse Racing** - Field size, track conditions
- **F1/NASCAR** - Team/driver dynamics

**Implementation time:** 2-4 weeks per sport

### New Sport Implementation Checklist

```markdown
[ ] Research available APIs
[ ] Define sport-specific types (stats, markets)
[ ] Create DataProvider implementation
[ ] Add to ProviderFactory
[ ] Define projection methodology
[ ] Add edge detection markets
[ ] Update CLI and API routes
[ ] Add to frontend UI
[ ] Write tests
[ ] Document in APIS_AND_WEBHOOKS.md
```

---

## Model Sophistication

### Phase 1: Enhanced Statistical Model

**Current → Enhanced:**

```
Current:
- Weighted historical average
- Simple injury adjustment
- Home/away factor

Enhanced:
- Rolling weighted averages with decay
- Matchup-specific adjustments
- Pace/tempo normalization
- Usage rate projection
- Rest day modeling
- Variance estimation
```

**Implementation:**

```typescript
interface EnhancedProjectionModel {
  // Base projection
  calculateBase(stats: PlayerStats[]): number;
  
  // Adjustments
  applyMatchupAdjustment(vs: Team): number;
  applyPaceAdjustment(gamePace: number): number;
  applyUsageAdjustment(usageRate: number): number;
  applyRestAdjustment(daysRest: number): number;
  
  // Confidence
  calculateVariance(stats: PlayerStats[]): number;
  calculateConfidenceInterval(projection: number, variance: number): [number, number];
}
```

### Phase 2: Machine Learning Integration

**Models to consider:**

1. **Gradient Boosting (XGBoost/LightGBM)**
   - Best for tabular data
   - Fast training and inference
   - Interpretable feature importance

2. **Neural Networks**
   - Player embedding models
   - Sequence models for streaks
   - Attention mechanisms for matchups

3. **Ensemble Methods**
   - Combine multiple models
   - Weight by recent performance
   - Reduce variance

**Example ML Pipeline:**

```typescript
// Feature engineering
interface ProjectionFeatures {
  // Player history
  lastNGamesAvg: number;
  lastNGamesStd: number;
  seasonAvg: number;
  
  // Matchup
  vsTeamAvg: number;
  opponentDefRank: number;
  
  // Context
  isHome: boolean;
  daysRest: number;
  backToBack: boolean;
  
  // Meta
  lineMovement: number;
  consensusLine: number;
}

// Model training
async function trainModel(features: FeatureDataset) {
  const model = new XGBRegressor({
    objective: 'reg:squarederror',
    n_estimators: 100,
    max_depth: 6,
  });
  
  await model.fit(features.X, features.y);
  return model;
}
```

### Phase 3: Simulation Engine

**Monte Carlo simulation for probability estimation:**

```typescript
class SimulationEngine {
  async simulateGame(game: Game, iterations: number = 10000): Promise<SimulationResult> {
    const results: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const gameResult = this.simulateSingleGame(game);
      results.push(gameResult);
    }
    
    return {
      meanScore: mean(results),
      medianScore: median(results),
      stdDev: std(results),
      percentiles: calculatePercentiles(results, [10, 25, 50, 75, 90]),
      probabilityOver: calculateProbability(results, threshold),
    };
  }
  
  private simulateSingleGame(game: Game): number {
    // Simulate possessions, shots, outcomes
    // Using probability distributions for each event
  }
}
```

---

## Scaling Strategies

### 1. Caching Layer

```typescript
// Redis caching for API responses
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedOrFetch(key: string, fetcher: () => Promise<any>, ttl: number = 300) {
  const cached = await redis.get(key);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));
  
  return data;
}

// Usage
const schedule = await getCachedOrFetch(
  `schedule:${league}:${date}`,
  () => provider.getSchedule(league, date),
  300 // 5 minute TTL
);
```

### 2. Job Queue

```typescript
// Bull queue for background processing
import Queue from 'bull';

const projectionQueue = new Queue('projections', process.env.REDIS_URL);

// Producer
projectionQueue.add('generate', {
  league: 'NBA',
  date: '2024-01-15',
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
});

// Consumer
projectionQueue.process('generate', async (job) => {
  const { league, date } = job.data;
  await projectionEngine.generateProjections(league, date);
});
```

### 3. Rate Limit Handling

```typescript
import Bottleneck from 'bottleneck';

// Create limiter per API
const espnLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200, // 5 requests per second
});

// Wrap API calls
async function getScheduleRateLimited(league: League, date: string) {
  return espnLimiter.schedule(() => 
    provider.getSchedule(league, date)
  );
}
```

### 4. Horizontal Scaling

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - REDIS_URL=redis://redis:6379
      - DB_PATH=/data/slipsmith.db
    volumes:
      - ./data:/data
    deploy:
      replicas: 3
      
  worker:
    build: .
    command: npm run worker
    environment:
      - REDIS_URL=redis://redis:6379
    deploy:
      replicas: 2
      
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

---

## Roadmap

### Q1 2024: Foundation

- [x] Core projection engine
- [x] Multi-sport provider architecture
- [x] Edge detection system
- [x] Evaluation/learning loop
- [x] Basic API and UI
- [x] Documentation

### Q2 2024: Enhancement

- [ ] Add WNBA, Euroleague providers
- [ ] Improve projection model accuracy
- [ ] Add pace/tempo adjustments
- [ ] Implement caching layer
- [ ] Add Discord/Slack notifications
- [ ] Build mobile-friendly UI

### Q3 2024: ML Integration

- [ ] Feature engineering pipeline
- [ ] Train XGBoost models
- [ ] A/B test ML vs statistical
- [ ] Implement ensemble method
- [ ] Add simulation engine
- [ ] Backtesting framework

### Q4 2024: Scale

- [ ] Multi-region deployment
- [ ] Job queue for batch processing
- [ ] Real-time odds integration
- [ ] Premium tier features
- [ ] API for third-party access
- [ ] Compliance/licensing review

### 2025 and Beyond

- [ ] Native mobile apps
- [ ] AI-powered chatbot
- [ ] Live in-game projections
- [ ] Community features
- [ ] Expand to new sports
- [ ] International markets

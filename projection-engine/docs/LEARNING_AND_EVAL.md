# Learning and Evaluation System

This document describes the self-learning system that tracks predictions, evaluates results, and improves projections over time.

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Evaluation Loop](#evaluation-loop)
4. [Reliability Scoring](#reliability-scoring)
5. [Using Reliability Data](#using-reliability-data)
6. [Metrics and Reports](#metrics-and-reports)

---

## Overview

The learning system operates on three principles:

1. **Track Everything** - Store all predictions with full context
2. **Evaluate Honestly** - Compare predictions to actual results without bias
3. **Learn Continuously** - Update reliability scores to improve future projections

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Learning Cycle                                │
│                                                                      │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │  Generate   │────▶│   Store     │────▶│   Wait for  │          │
│   │ Projections │     │ Predictions │     │    Games    │          │
│   └─────────────┘     └─────────────┘     └──────┬──────┘          │
│                                                   │                  │
│                                                   ▼                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │   Apply     │◀────│   Update    │◀────│   Evaluate  │          │
│   │  Learning   │     │ Reliability │     │   Results   │          │
│   └─────────────┘     └─────────────┘     └─────────────┘          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

The system uses SQLite for simplicity and portability.

### Projections Table

Stores all generated predictions before games start.

```sql
CREATE TABLE projections (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    game_id TEXT NOT NULL,
    player_id TEXT,           -- NULL for team props
    team_id TEXT,             -- NULL for player props
    market TEXT NOT NULL,
    line REAL NOT NULL,
    direction TEXT NOT NULL,  -- 'over' or 'under'
    model_projection REAL NOT NULL,
    probability REAL NOT NULL,
    edge_score REAL NOT NULL,
    reasoning TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX idx_projections_date ON projections(date);
CREATE INDEX idx_projections_game ON projections(game_id);
CREATE INDEX idx_projections_player ON projections(player_id);
```

### Evaluations Table

Links projections to their actual outcomes.

```sql
CREATE TABLE evaluations (
    id TEXT PRIMARY KEY,
    projection_id TEXT NOT NULL,
    actual_value REAL,        -- The actual stat line
    result TEXT NOT NULL,     -- 'hit', 'miss', 'push', 'void'
    evaluated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projection_id) REFERENCES projections(id)
);

CREATE INDEX idx_evaluations_result ON evaluations(result);
```

### Reliability Scores Table

Aggregated hit rates by market type, player, and team.

```sql
CREATE TABLE reliability_scores (
    id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    player_id TEXT,           -- NULL for market-level scores
    team_id TEXT,
    market TEXT NOT NULL,
    total_bets INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    pushes INTEGER DEFAULT 0,
    voids INTEGER DEFAULT 0,
    hit_rate REAL DEFAULT 0,
    average_edge REAL DEFAULT 0,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport, league, player_id, team_id, market)
);

CREATE INDEX idx_reliability_market ON reliability_scores(sport, market);
```

---

## Evaluation Loop

### When to Run Evaluation

The evaluation should run:

1. **Daily** - Evaluate yesterday's games after all are final
2. **On Demand** - Manual trigger via CLI or API
3. **Batch** - Catch up on missed days

### Evaluation Process

```typescript
async function evaluateDate(date: string) {
  // 1. Get unevaluated projections
  const projections = await db.query(`
    SELECT p.* FROM projections p
    LEFT JOIN evaluations e ON p.id = e.projection_id
    WHERE p.date = ? AND e.id IS NULL
  `, [date]);
  
  // 2. Group by game for efficiency
  const byGame = groupBy(projections, 'game_id');
  
  for (const [gameId, gameProjections] of byGame) {
    // 3. Fetch actual box score
    const boxScore = await provider.getGameBoxScore(gameId);
    
    if (!boxScore) continue; // Game not finished
    
    // 4. Evaluate each projection
    for (const proj of gameProjections) {
      const actual = getActualValue(boxScore, proj);
      const result = determineResult(proj, actual);
      
      // 5. Store evaluation
      await db.insert('evaluations', {
        projection_id: proj.id,
        actual_value: actual,
        result: result,
      });
      
      // 6. Update reliability
      await updateReliability(proj, result);
    }
  }
}
```

### Result Determination

```typescript
function determineResult(
  proj: Projection, 
  actual: number | null
): EventResult {
  // Void if player didn't play
  if (actual === null || actual === undefined) {
    return 'void';
  }
  
  // Push if exactly on the line
  if (actual === proj.line) {
    return 'push';
  }
  
  // Hit/miss based on direction
  if (proj.direction === 'over') {
    return actual > proj.line ? 'hit' : 'miss';
  } else {
    return actual < proj.line ? 'hit' : 'miss';
  }
}
```

### Void Handling

Events are voided only when:
- Player was ruled out before game start
- Player was DNP (Did Not Play)
- Game was postponed/cancelled

Events are **NOT** voided when:
- Player performed poorly
- Player was pulled early (non-injury)
- Blowout affected playing time

---

## Reliability Scoring

### Score Aggregation Levels

Reliability scores are maintained at multiple levels:

1. **Market Level** - Overall hit rate for a market type
   - e.g., "NBA POINTS overall hit rate"

2. **Player-Market Level** - Player-specific patterns
   - e.g., "LeBron James POINTS hit rate"

3. **Team-Market Level** - Team tendencies
   - e.g., "Lakers TEAM_TOTAL hit rate"

### Update Algorithm

```typescript
function updateReliability(proj: Projection, result: EventResult) {
  // Get or create reliability record
  let score = await db.findOne('reliability_scores', {
    sport: proj.sport,
    league: proj.league,
    player_id: proj.player_id,
    team_id: proj.team_id,
    market: proj.market,
  });
  
  if (!score) {
    score = createNewScore(proj);
  }
  
  // Update counts (excluding voids from total)
  if (result !== 'void') {
    score.total_bets++;
  }
  
  switch (result) {
    case 'hit':
      score.hits++;
      break;
    case 'miss':
      score.misses++;
      break;
    case 'push':
      score.pushes++;
      break;
    case 'void':
      score.voids++;
      break;
  }
  
  // Recalculate hit rate
  const decidedBets = score.hits + score.misses;
  score.hit_rate = decidedBets > 0 
    ? score.hits / decidedBets 
    : 0;
  
  // Update moving average of edge
  score.average_edge = calculateMovingAverageEdge(score, proj);
  
  await db.update('reliability_scores', score);
}
```

### Hit Rate Calculation

```
hit_rate = hits / (hits + misses)
```

Pushes and voids are excluded from hit rate calculation as they didn't resolve.

### Confidence Adjustment

Low sample sizes need caution:

```typescript
function getAdjustedReliability(score: ReliabilityScore): number {
  const sampleSize = score.total_bets;
  
  // Regress to mean with small samples
  const regressionFactor = Math.min(1, sampleSize / 50);
  const baseRate = 0.5; // Assumed true probability
  
  return baseRate + (score.hit_rate - baseRate) * regressionFactor;
}
```

---

## Using Reliability Data

### In Edge Detection

Reliability scores affect the final edge score:

```typescript
function calculateEdgeScore(
  edge: number,
  confidence: number,
  reliability: number
): number {
  return (
    normalizedEdge * 0.5 +    // Raw edge value
    confidence * 0.3 +        // Model confidence
    reliability * 0.2         // Historical accuracy
  ) * 10;
}
```

### Filtering High-Reliability Bets

```typescript
// Get only events where we have historical accuracy
const reliableEvents = events.filter(e => {
  const reliability = reliabilityScores.get(`${e.playerId}_${e.market}`);
  return reliability && reliability.total_bets >= 20 && reliability.hit_rate > 0.52;
});
```

### Adjusting Projections

Future enhancement: Use reliability to adjust projections themselves.

```typescript
function adjustProjection(
  baseProjection: number,
  reliability: ReliabilityScore
): number {
  // If we consistently over-project, reduce
  // If we consistently under-project, increase
  const bias = calculateBias(reliability);
  return baseProjection * (1 - bias);
}
```

---

## Metrics and Reports

### Overall Performance

```sql
-- Overall hit rate
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN result = 'hit' THEN 1 ELSE 0 END) as hits,
    SUM(CASE WHEN result = 'miss' THEN 1 ELSE 0 END) as misses,
    CAST(SUM(CASE WHEN result = 'hit' THEN 1 ELSE 0 END) AS FLOAT) / 
    NULLIF(SUM(CASE WHEN result IN ('hit', 'miss') THEN 1 ELSE 0 END), 0) as hit_rate
FROM evaluations e
JOIN projections p ON e.projection_id = p.id
WHERE p.date BETWEEN ? AND ?;
```

### Performance by Market

```sql
SELECT 
    p.market,
    COUNT(*) as total,
    SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) as hits,
    ROUND(CAST(SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) AS FLOAT) / 
          NULLIF(SUM(CASE WHEN e.result IN ('hit', 'miss') THEN 1 ELSE 0 END), 0), 3) as hit_rate
FROM evaluations e
JOIN projections p ON e.projection_id = p.id
WHERE e.result IN ('hit', 'miss')
GROUP BY p.market
ORDER BY hit_rate DESC;
```

### Performance by Edge Score Tier

```sql
SELECT 
    CASE 
        WHEN p.edge_score >= 8 THEN 'Strong (8+)'
        WHEN p.edge_score >= 5 THEN 'Moderate (5-8)'
        ELSE 'Weak (<5)'
    END as tier,
    COUNT(*) as total,
    SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) as hits,
    ROUND(CAST(SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) AS FLOAT) / 
          COUNT(*), 3) as hit_rate
FROM evaluations e
JOIN projections p ON e.projection_id = p.id
WHERE e.result IN ('hit', 'miss')
GROUP BY tier
ORDER BY tier;
```

### Daily Performance Trend

```sql
SELECT 
    p.date,
    COUNT(*) as total,
    SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) as hits,
    SUM(CASE WHEN e.result = 'miss' THEN 1 ELSE 0 END) as misses
FROM evaluations e
JOIN projections p ON e.projection_id = p.id
GROUP BY p.date
ORDER BY p.date DESC
LIMIT 30;
```

### Best Performing Players

```sql
SELECT 
    p.player_id,
    p.sport,
    p.market,
    COUNT(*) as total,
    SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) as hits,
    ROUND(CAST(SUM(CASE WHEN e.result = 'hit' THEN 1 ELSE 0 END) AS FLOAT) / 
          COUNT(*), 3) as hit_rate
FROM evaluations e
JOIN projections p ON e.projection_id = p.id
WHERE e.result IN ('hit', 'miss')
GROUP BY p.player_id, p.sport, p.market
HAVING COUNT(*) >= 10
ORDER BY hit_rate DESC
LIMIT 20;
```

---

## CLI Commands

```bash
# Run evaluation for yesterday
npx ts-node src/cli.ts evaluate --date yesterday

# View summary for date range
npx ts-node src/cli.ts summary --start 2024-01-01 --end 2024-01-31

# View reliability report
npx ts-node src/cli.ts reliability --sport basketball
```

---

## Best Practices

### 1. Regular Evaluation

Run evaluation daily after all games finish:

```bash
# Cron job at 6 AM ET
0 6 * * * cd /app && npx ts-node src/cli.ts evaluate --date yesterday
```

### 2. Monitor Key Metrics

Track these over time:
- Overall hit rate (target: 52%+)
- Hit rate by edge tier
- Void rate (should be low)
- Average edge on hits vs misses

### 3. Act on Insights

If a market or player shows consistent under/over-performance:
- Investigate root cause
- Adjust model weights
- Update confidence thresholds

### 4. Sample Size Awareness

Don't overreact to small samples:
- < 20 bets: Random variance likely
- 20-50 bets: Emerging pattern
- 50+ bets: Likely true signal

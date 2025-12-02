# Firebase Integration Guide

This document describes how the SlipSmith Projection Engine integrates with Firebase/Firestore for storing projections, results, slips, and reliability ledger data.

## Table of Contents

1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [Firestore Collections](#firestore-collections)
4. [API Reference](#api-reference)
5. [Cloudflare Compatibility](#cloudflare-compatibility)
6. [Security Rules](#security-rules)

---

## Overview

The Projection Engine uses Firebase Firestore as its "long-term memory" for storing:

- **Projections**: Predicted box scores for upcoming games
- **Results**: Actual game results for evaluation
- **Slips**: Daily picks in the SlipSmith JSON format
- **Players Ledger**: Reliability tracking per player
- **Markets Ledger**: Performance tracking per market type

The integration is designed to work in multiple environments:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Firebase Integration Modes                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Node.js Backend          Cloudflare Workers        Browser         │
│   ┌─────────────┐          ┌─────────────┐          ┌──────────┐   │
│   │ Admin SDK   │          │ REST API    │          │ JS SDK   │   │
│   │ (Preferred) │          │ (Fallback)  │          │ (window) │   │
│   └──────┬──────┘          └──────┬──────┘          └────┬─────┘   │
│          │                        │                       │         │
│          └────────────────────────┴───────────────────────┘         │
│                                   │                                  │
│                           ┌───────▼───────┐                         │
│                           │   Firestore   │                         │
│                           └───────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Environment Setup

### Required Environment Variables

```bash
# Firebase Project ID (REQUIRED)
FIREBASE_PROJECT_ID=your-project-id

# For Node.js/Local Development (Option A - Recommended)
# Download from: Firebase Console > Project Settings > Service Accounts
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# For Cloudflare Workers / REST API Mode (Option B)
# Get from: Firebase Console > Project Settings > General > Web API Key
FIREBASE_API_KEY=your-web-api-key
```

### Local Development Setup

1. **Download Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely

2. **Configure Environment**:
   ```bash
   cd projection-engine
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Initialize in Code**:
   ```typescript
   import { initializeFirebase } from './services/slipsmithFirebase';
   
   await initializeFirebase({
     projectId: process.env.FIREBASE_PROJECT_ID,
   });
   ```

### Cloudflare Workers Setup

For Cloudflare Workers, the module automatically uses the REST API mode:

```typescript
// wrangler.toml
[vars]
FIREBASE_PROJECT_ID = "your-project-id"
FIREBASE_API_KEY = "your-api-key"
```

```typescript
// worker.ts
import { initializeFirebase } from './services/slipsmithFirebase';

await initializeFirebase({
  projectId: env.FIREBASE_PROJECT_ID,
  apiKey: env.FIREBASE_API_KEY,
  useRestApi: true,
});
```

---

## Firestore Collections

### 1. Projections

**Path**: `projections/{date}/games/{gameId}`

Stores projected box scores for games.

```typescript
interface ProjectionDocument {
  sport: 'basketball' | 'football' | 'soccer' | 'esports';
  league: string;           // e.g., 'NBA', 'NFL', 'EPL'
  game_id: string;
  home_team: string;
  away_team: string;
  start_time: string;       // ISO timestamp
  home_score_projection: number;
  away_score_projection: number;
  pace?: number;            // Sport-specific (possessions, plays, etc.)
  players: PlayerProjection[];
  generated_at: Timestamp;
}

interface PlayerProjection {
  player_id: string;
  player_name: string;
  team_id: string;
  position: string;
  projected_stats: Record<string, number>;  // e.g., { points: 25.5, rebounds: 8.2 }
  confidence: number;       // 0-1
  adjustments?: Array<{
    type: string;           // 'matchup', 'trend', 'injury'
    factor: number;
    description: string;
  }>;
}
```

**Example**:
```json
{
  "sport": "basketball",
  "league": "NBA",
  "game_id": "PHX@LAL_20251201",
  "home_team": "Los Angeles Lakers",
  "away_team": "Phoenix Suns",
  "start_time": "2025-12-01T22:30:00Z",
  "home_score_projection": 114.5,
  "away_score_projection": 108.2,
  "players": [
    {
      "player_id": "lebron_james",
      "player_name": "LeBron James",
      "team_id": "LAL",
      "position": "SF",
      "projected_stats": {
        "points": 27.5,
        "rebounds": 8.2,
        "assists": 7.1
      },
      "confidence": 0.85
    }
  ],
  "generated_at": "2025-12-01T10:00:00Z"
}
```

### 2. Results

**Path**: `results/{date}/games/{gameId}`

Stores actual game results for evaluation.

```typescript
interface ResultDocument {
  sport: string;
  league: string;
  game_id: string;
  home_team: string;
  away_team: string;
  final_score_home: number;
  final_score_away: number;
  players: PlayerResult[];
  recorded_at: Timestamp;
}

interface PlayerResult {
  player_id: string;
  player_name: string;
  team_id: string;
  actual_stats: Record<string, number>;
}
```

### 3. Slips

**Path**: `slips/{slipId}`

Stores daily picks in the SlipSmith JSON format.

```typescript
interface SlipDocument {
  slip_id: string;          // Format: SPORT_YYYY_MM_DD_TIER
  date: string;             // YYYY-MM-DD
  sport: string;
  tier: 'starter' | 'pro' | 'vip';
  warning?: string;         // Optional data limitations note
  events: SlipEvent[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface SlipEvent {
  event_id: string;
  game_id: string;
  time: string;
  player?: string;          // Nullable for team markets
  team: string;
  market: string;           // e.g., 'points', 'rebounds+assists'
  line: number;
  direction: 'over' | 'under';
  probability: string;      // e.g., '83%'
  reasoning: string;
}
```

**Example**:
```json
{
  "slip_id": "NBA_2025_12_01_VIP",
  "date": "2025-12-01",
  "sport": "NBA",
  "tier": "vip",
  "events": [
    {
      "event_id": "nba_suns_lakers_reaves_ra8_5_over_20251201",
      "game_id": "PHX@LAL",
      "time": "10:30 PM ET",
      "player": "Austin Reaves",
      "team": "LAL",
      "market": "rebounds+assists",
      "line": 8.5,
      "direction": "over",
      "probability": "83%",
      "reasoning": "Reaves averaging 9.2 R+A over last 10 games with increased role."
    }
  ]
}
```

### 4. Players Ledger

**Path**: `players_ledger/{playerId}`

Stores reliability data for each player.

```typescript
interface PlayerLedger {
  player_id: string;
  player_name?: string;
  total_bets: number;
  hits: number;
  misses: number;
  pushes: number;
  voids: number;
  hit_rate: number;         // 0-1
  markets: Record<string, MarketStats>;
  last_updated: Timestamp;
}

interface MarketStats {
  total: number;
  hits: number;
  misses: number;
  hit_rate: number;
  average_edge: number;
}
```

### 5. Markets Ledger (Optional)

**Path**: `markets_ledger/{marketId}`

Aggregates performance by market type.

```typescript
interface MarketLedger {
  market_id: string;        // e.g., 'nba_points_over'
  sport: string;
  league: string;
  market_type: string;
  total_bets: number;
  hits: number;
  misses: number;
  hit_rate: number;
  average_edge: number;
  last_updated: Timestamp;
}
```

---

## API Reference

### Initialization

```typescript
import { 
  initializeFirebase, 
  isFirebaseAvailable 
} from './services/slipsmithFirebase';

// Initialize with environment variables
await initializeFirebase();

// Or with explicit config
await initializeFirebase({
  projectId: 'my-project',
  apiKey: 'my-api-key',
  useRestApi: true,  // Force REST API mode
});

// Check availability
if (isFirebaseAvailable()) {
  console.log('Firebase ready');
}
```

### Projections

```typescript
import { 
  saveProjections, 
  getProjections 
} from './services/slipsmithFirebase';

// Save projections
await saveProjections('2025-12-01', 'NBA', gameProjections);

// Get projections (optional sport filter)
const projections = await getProjections('2025-12-01', 'NBA');
```

### Results

```typescript
import { 
  saveResults, 
  getResults 
} from './services/slipsmithFirebase';

// Save results
await saveResults('2025-12-01', 'NBA', gameResults);

// Get results
const results = await getResults('2025-12-01', 'NBA');
```

### Slips

```typescript
import { 
  saveSlip, 
  getSlip, 
  listSlips,
  generateSlipId 
} from './services/slipsmithFirebase';

// Generate slip ID
const slipId = generateSlipId('NBA', '2025-12-01', 'vip');
// => 'NBA_2025_12_01_VIP'

// Save slip
await saveSlip({
  slip_id: slipId,
  date: '2025-12-01',
  sport: 'NBA',
  tier: 'vip',
  events: [...],
});

// Get slip
const slip = await getSlip(slipId);

// List slips with filters
const slips = await listSlips({
  date: '2025-12-01',
  sport: 'NBA',
  tier: 'vip',
  limit: 10,
});
```

### Players Ledger

```typescript
import { 
  updatePlayersLedger, 
  getPlayerLedger 
} from './services/slipsmithFirebase';

// Update ledger after grading
await updatePlayersLedger([
  {
    playerId: 'lebron_james',
    market: 'points',
    result: 'hit',
    projection: 27.5,
    actual: 32,
    line: 26.5,
    edge: 1.0,
    date: '2025-12-01',
  },
]);

// Get player stats
const ledger = await getPlayerLedger('lebron_james');
console.log(`Hit rate: ${(ledger.hit_rate * 100).toFixed(1)}%`);
```

---

## Cloudflare Compatibility

The Firebase integration is designed to work seamlessly with Cloudflare Pages and Workers:

### Static Frontend (Cloudflare Pages)

The projection engine frontend (`frontend/index.html`) works as a static site:

1. **No Build Required**: Pure HTML/CSS/JS
2. **API Calls**: Connects to backend API for data
3. **Firebase JS SDK**: Can use the main app's `firebase.js`

### Cloudflare Workers Backend

For serverless backend on Cloudflare Workers:

```typescript
// worker.ts
import { initializeFirebase, saveProjections } from './services/slipsmithFirebase';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize with REST API mode for Workers
    await initializeFirebase({
      projectId: env.FIREBASE_PROJECT_ID,
      apiKey: env.FIREBASE_API_KEY,
      useRestApi: true,
    });
    
    // Handle API requests
    const url = new URL(request.url);
    
    if (url.pathname === '/api/projections' && request.method === 'POST') {
      const body = await request.json();
      await saveProjections(body.date, body.sport, body.games);
      return new Response(JSON.stringify({ success: true }));
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
```

### Limitations in Workers

Due to Cloudflare Workers limitations:

1. **No Admin SDK**: Uses REST API instead
2. **No File System**: Service account must be passed as config
3. **Batch Operations**: Implemented as sequential requests

---

## Security Rules

Ensure your Firestore security rules allow the projection engine to read/write:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Projections - Admin/Bot write, authenticated read
    match /projections/{date}/games/{gameId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    
    // Results - Admin/Bot write, authenticated read
    match /results/{date}/games/{gameId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    
    // Slips - Admin/Bot write, tier-based read
    match /slips/{slipId} {
      allow read: if request.auth != null && canReadTier(resource.data.tier);
      allow write: if isAdmin();
    }
    
    // Players Ledger - Admin/Bot only
    match /players_ledger/{playerId} {
      allow read, write: if isAdmin();
    }
    
    // Markets Ledger - Admin/Bot only
    match /markets_ledger/{marketId} {
      allow read, write: if isAdmin();
    }
    
    // Helper functions
    function isAdmin() {
      return request.auth != null && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }
    
    function canReadTier(tier) {
      let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      let userTier = userData.tier;
      
      return (tier == 'starter') ||
             (tier == 'pro' && userTier in ['pro', 'vip']) ||
             (tier == 'vip' && userTier == 'vip');
    }
  }
}
```

### Service Account Authentication

When using the Firebase Admin SDK with a service account, the SDK bypasses Firestore security rules entirely. The service account operates with full administrative access.

**For Node.js Backend (Admin SDK)**:
- Download service account from Firebase Console
- Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- The Admin SDK automatically authenticates with full access

**For Cloudflare Workers (REST API)**:
- Use Firebase Authentication to create a custom token
- Or use a Firebase API key with appropriate restrictions
- Consider using Firebase App Check for additional security

**Production Recommendations**:
1. Store service account keys securely (never commit to git)
2. Use environment variables or secret management
3. Restrict API keys by HTTP referrer or IP
4. Enable Firebase App Check for production

---

## Troubleshooting

### Common Issues

1. **"Firebase not initialized"**
   - Ensure `initializeFirebase()` is called before other operations
   - Check that environment variables are set

2. **"Permission denied"**
   - Verify Firestore security rules
   - Check that the service account has correct permissions

3. **REST API 401 errors**
   - API key may be invalid or restricted
   - Check Firebase Console for API restrictions

4. **Cloudflare Workers timeout**
   - Batch operations may take too long
   - Consider using Durable Objects for complex operations

### Debug Mode

Enable verbose logging:

```typescript
// In your code
process.env.DEBUG = 'slipsmith:*';
```

Or check browser console for Firebase operations.

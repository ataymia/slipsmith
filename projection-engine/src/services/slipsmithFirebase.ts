/**
 * SlipSmith Firebase Integration Module
 * 
 * Provides integration with the existing SlipSmith Firebase project
 * for storing projections, results, slips, and reliability ledger data.
 * 
 * This module is designed to work in multiple environments:
 * - Node.js backend (using Firebase Admin SDK when available)
 * - Cloudflare Workers/Pages (using Firestore REST API)
 * - Browser (delegates to window.db from the main app's firebase.js)
 * 
 * For Cloudflare compatibility, we provide both Admin SDK and REST API modes.
 */

import type {
  Sport,
  League,
  GameProjection,
  SlipSmithSlip,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Firestore Timestamp representation (compatible across environments)
 */
export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

/**
 * Game projection stored in Firestore
 */
export interface FirestoreGameProjection {
  sport: Sport;
  league: League;
  game_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_score_projection: number;
  away_score_projection: number;
  pace?: number;
  players: FirestorePlayerProjection[];
  generated_at: FirestoreTimestamp | Date | string;
}

/**
 * Player projection stored in Firestore
 */
export interface FirestorePlayerProjection {
  player_id: string;
  player_name: string;
  team_id: string;
  position: string;
  projected_stats: Record<string, number>;
  confidence: number;
  adjustments?: Array<{ type: string; factor: number; description: string }>;
}

/**
 * Game result stored in Firestore
 */
export interface GameResult {
  sport: Sport;
  league: League;
  game_id: string;
  home_team: string;
  away_team: string;
  final_score_home: number;
  final_score_away: number;
  players: PlayerResult[];
  recorded_at: FirestoreTimestamp | Date | string;
}

/**
 * Player result stored in Firestore
 */
export interface PlayerResult {
  player_id: string;
  player_name: string;
  team_id: string;
  actual_stats: Record<string, number>;
}

/**
 * Player ledger update for reliability tracking
 */
export interface PlayerLedgerUpdate {
  playerId: string;
  market: string;
  result: 'hit' | 'miss' | 'push' | 'void';
  projection: number;
  actual: number;
  line: number;
  edge: number;
  date: string;
}

/**
 * Player ledger data stored in Firestore
 */
export interface PlayerLedger {
  player_id: string;
  player_name?: string;
  total_bets: number;
  hits: number;
  misses: number;
  pushes: number;
  voids: number;
  hit_rate: number;
  markets: Record<string, MarketStats>;
  last_updated: FirestoreTimestamp | Date | string;
}

/**
 * Market-level statistics
 */
export interface MarketStats {
  total: number;
  hits: number;
  misses: number;
  hit_rate: number;
  average_edge: number;
}

/**
 * Market ledger data
 */
export interface MarketLedger {
  market_id: string;
  sport: Sport;
  league: League;
  market_type: string;
  total_bets: number;
  hits: number;
  misses: number;
  hit_rate: number;
  average_edge: number;
  last_updated: FirestoreTimestamp | Date | string;
}

/**
 * Firebase configuration
 */
export interface FirebaseConfig {
  projectId: string;
  apiKey?: string;
  authDomain?: string;
  /** For Admin SDK: path to service account file or service account object */
  serviceAccount?: string | object;
  /** Use REST API instead of Admin SDK (for Cloudflare Workers) */
  useRestApi?: boolean;
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Detect the current runtime environment
 */
function detectEnvironment(): 'node' | 'cloudflare' | 'browser' {
  // Check for browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }
  
  // Check for Cloudflare Workers (no process.versions.node)
  if (typeof process === 'undefined' || !process.versions?.node) {
    return 'cloudflare';
  }
  
  return 'node';
}

const ENV = detectEnvironment();

// ============================================================================
// Firebase Client State
// ============================================================================

let firebaseInitialized = false;
let firebaseConfig: FirebaseConfig | null = null;

// For Node.js Admin SDK
let adminApp: any = null;
let adminDb: any = null;

// For REST API mode (Cloudflare Workers)
let accessToken: string | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize Firebase connection
 * 
 * Environment variables used:
 * - FIREBASE_PROJECT_ID: Required - The Firebase project ID
 * - GOOGLE_APPLICATION_CREDENTIALS: For Node.js Admin SDK
 * - FIREBASE_API_KEY: For REST API mode
 */
export async function initializeFirebase(config?: Partial<FirebaseConfig>): Promise<void> {
  if (firebaseInitialized) {
    return;
  }

  const projectId = config?.projectId || 
                    (typeof process !== 'undefined' ? process.env?.FIREBASE_PROJECT_ID : undefined);

  if (!projectId) {
    console.warn('FIREBASE_PROJECT_ID not set. Firebase integration will be unavailable.');
    return;
  }

  firebaseConfig = {
    projectId,
    apiKey: config?.apiKey || (typeof process !== 'undefined' ? process.env?.FIREBASE_API_KEY : undefined),
    serviceAccount: config?.serviceAccount,
    useRestApi: config?.useRestApi ?? (ENV === 'cloudflare'),
  };

  if (ENV === 'node' && !firebaseConfig.useRestApi) {
    await initializeAdminSdk();
  } else if (ENV === 'browser') {
    // In browser, we rely on window.db from the main app
    if (typeof window !== 'undefined' && (window as any).db) {
      firebaseInitialized = true;
      console.log('Firebase: Using browser SDK from main app');
    } else {
      console.warn('Firebase: Browser SDK not available. Ensure firebase.js is loaded.');
    }
  } else {
    // Cloudflare Workers or REST API mode
    console.log('Firebase: Using REST API mode for Cloudflare compatibility');
    firebaseInitialized = true;
  }
}

/**
 * Initialize Firebase Admin SDK (Node.js only)
 */
async function initializeAdminSdk(): Promise<void> {
  try {
    // Dynamic import for Admin SDK (only in Node.js)
    const adminModule = await import('firebase-admin');
    const admin = adminModule.default || adminModule;

    if (!admin.apps.length) {
      if (firebaseConfig?.serviceAccount) {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert(firebaseConfig.serviceAccount as any),
          projectId: firebaseConfig.projectId,
        });
      } else {
        // Use application default credentials
        adminApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: firebaseConfig?.projectId,
        });
      }
    } else {
      adminApp = admin.apps[0];
    }

    adminDb = admin.firestore();
    firebaseInitialized = true;
    console.log(`Firebase Admin SDK initialized for project: ${firebaseConfig?.projectId}`);
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    console.log('Falling back to REST API mode');
    firebaseConfig!.useRestApi = true;
    firebaseInitialized = true;
  }
}

/**
 * Check if Firebase is available
 */
export function isFirebaseAvailable(): boolean {
  return firebaseInitialized;
}

/**
 * Get the Firestore database instance (for Admin SDK mode)
 */
export function getFirestore(): any {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  
  if (ENV === 'browser' && typeof window !== 'undefined') {
    return (window as any).db;
  }
  
  if (adminDb) {
    return adminDb;
  }
  
  throw new Error('Firestore not available in current mode');
}

// ============================================================================
// REST API Helpers (for Cloudflare Workers)
// ============================================================================

/**
 * Make a Firestore REST API request
 */
async function firestoreRestRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: any
): Promise<any> {
  if (!firebaseConfig?.projectId) {
    throw new Error('Firebase project ID not configured');
  }

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
  const url = `${baseUrl}/${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (firebaseConfig.apiKey) {
    // Use API key for unauthenticated access (limited)
    const separator = url.includes('?') ? '&' : '?';
    const urlWithKey = `${url}${separator}key=${firebaseConfig.apiKey}`;
    
    const response = await fetch(urlWithKey, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firestore REST API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore REST API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Convert a JavaScript object to Firestore REST API format
 */
function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue),
      },
    };
  }
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = toFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

/**
 * Convert Firestore REST API format to JavaScript object
 */
function fromFirestoreValue(value: any): any {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value.mapValue.fields || {})) {
      result[key] = fromFirestoreValue(val);
    }
    return result;
  }
  return null;
}

/**
 * Convert document fields from REST format
 */
function fromFirestoreDocument(doc: any): any {
  if (!doc?.fields) return null;
  
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    result[key] = fromFirestoreValue(value);
  }
  return result;
}

// ============================================================================
// Projections Operations
// ============================================================================

/**
 * Save game projections to Firestore
 */
export async function saveProjections(
  date: string,
  sport: string,
  games: GameProjection[]
): Promise<void> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping saveProjections');
    return;
  }

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    // Browser mode - use window.db
    const db = (window as any).db;
    const batch = db.batch();

    for (const game of games) {
      const docRef = db.collection('projections').doc(date).collection('games').doc(game.gameId);
      batch.set(docRef, {
        sport: game.sport,
        league: game.league,
        game_id: game.gameId,
        home_team: game.homeTeam.teamName,
        away_team: game.awayTeam.teamName,
        start_time: game.date,
        home_score_projection: game.homeTeam.projectedScore,
        away_score_projection: game.awayTeam.projectedScore,
        players: game.players.map((p) => ({
          player_id: p.playerId,
          player_name: p.playerName,
          team_id: p.teamId,
          position: p.position,
          projected_stats: p.projectedStats,
          confidence: p.confidence,
        })),
        generated_at: new Date(),
      }, { merge: true });
    }

    await batch.commit();
  } else if (adminDb) {
    // Node.js Admin SDK mode
    const batch = adminDb.batch();

    for (const game of games) {
      const docRef = adminDb.collection('projections').doc(date).collection('games').doc(game.gameId);
      batch.set(docRef, {
        sport: game.sport,
        league: game.league,
        game_id: game.gameId,
        home_team: game.homeTeam.teamName,
        away_team: game.awayTeam.teamName,
        start_time: game.date,
        home_score_projection: game.homeTeam.projectedScore,
        away_score_projection: game.awayTeam.projectedScore,
        players: game.players.map((p) => ({
          player_id: p.playerId,
          player_name: p.playerName,
          team_id: p.teamId,
          position: p.position,
          projected_stats: p.projectedStats,
          confidence: p.confidence,
        })),
        generated_at: new Date(),
      }, { merge: true });
    }

    await batch.commit();
  } else {
    // REST API mode for Cloudflare
    for (const game of games) {
      const path = `projections/${date}/games/${game.gameId}`;
      const fields: Record<string, any> = {};
      
      const data = {
        sport: game.sport,
        league: game.league,
        game_id: game.gameId,
        home_team: game.homeTeam.teamName,
        away_team: game.awayTeam.teamName,
        start_time: game.date,
        home_score_projection: game.homeTeam.projectedScore,
        away_score_projection: game.awayTeam.projectedScore,
        players: game.players.map((p) => ({
          player_id: p.playerId,
          player_name: p.playerName,
          team_id: p.teamId,
          position: p.position,
          projected_stats: p.projectedStats,
          confidence: p.confidence,
        })),
        generated_at: new Date(),
      };

      for (const [key, value] of Object.entries(data)) {
        fields[key] = toFirestoreValue(value);
      }

      await firestoreRestRequest('PATCH', `${path}?updateMask.fieldPaths=*`, { fields });
    }
  }

  console.log(`Saved ${games.length} projections for ${date}/${sport}`);
}

/**
 * Get projections from Firestore
 */
export async function getProjections(
  date: string,
  sport?: string
): Promise<FirestoreGameProjection[]> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized');
    return [];
  }

  let projections: FirestoreGameProjection[] = [];

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    const db = (window as any).db;
    const snapshot = await db.collection('projections').doc(date).collection('games').get();
    projections = snapshot.docs.map((doc: any) => doc.data() as FirestoreGameProjection);
  } else if (adminDb) {
    const snapshot = await adminDb.collection('projections').doc(date).collection('games').get();
    projections = snapshot.docs.map((doc: any) => doc.data() as FirestoreGameProjection);
  } else {
    // REST API mode
    const response = await firestoreRestRequest('GET', `projections/${date}/games`);
    if (response.documents) {
      projections = response.documents.map((doc: any) => fromFirestoreDocument(doc));
    }
  }

  if (sport) {
    projections = projections.filter(
      (p) => p.sport?.toLowerCase() === sport.toLowerCase() ||
             p.league?.toLowerCase() === sport.toLowerCase()
    );
  }

  return projections;
}

// ============================================================================
// Results Operations
// ============================================================================

/**
 * Save game results to Firestore
 */
export async function saveResults(
  date: string,
  sport: string,
  results: GameResult[]
): Promise<void> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping saveResults');
    return;
  }

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    const db = (window as any).db;
    const batch = db.batch();

    for (const result of results) {
      const docRef = db.collection('results').doc(date).collection('games').doc(result.game_id);
      batch.set(docRef, { ...result, recorded_at: new Date() }, { merge: true });
    }

    await batch.commit();
  } else if (adminDb) {
    const batch = adminDb.batch();

    for (const result of results) {
      const docRef = adminDb.collection('results').doc(date).collection('games').doc(result.game_id);
      batch.set(docRef, { ...result, recorded_at: new Date() }, { merge: true });
    }

    await batch.commit();
  } else {
    // REST API mode
    for (const result of results) {
      const path = `results/${date}/games/${result.game_id}`;
      const data = { ...result, recorded_at: new Date() };
      const fields: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(data)) {
        fields[key] = toFirestoreValue(value);
      }

      await firestoreRestRequest('PATCH', `${path}?updateMask.fieldPaths=*`, { fields });
    }
  }

  console.log(`Saved ${results.length} results for ${date}/${sport}`);
}

/**
 * Get results from Firestore
 */
export async function getResults(date: string, sport?: string): Promise<GameResult[]> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized');
    return [];
  }

  let results: GameResult[] = [];

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    const db = (window as any).db;
    const snapshot = await db.collection('results').doc(date).collection('games').get();
    results = snapshot.docs.map((doc: any) => doc.data() as GameResult);
  } else if (adminDb) {
    const snapshot = await adminDb.collection('results').doc(date).collection('games').get();
    results = snapshot.docs.map((doc: any) => doc.data() as GameResult);
  } else {
    const response = await firestoreRestRequest('GET', `results/${date}/games`);
    if (response.documents) {
      results = response.documents.map((doc: any) => fromFirestoreDocument(doc));
    }
  }

  if (sport) {
    results = results.filter(
      (r) => r.sport?.toLowerCase() === sport.toLowerCase() ||
             r.league?.toLowerCase() === sport.toLowerCase()
    );
  }

  return results;
}

// ============================================================================
// Slips Operations
// ============================================================================

/**
 * Save a slip to Firestore
 */
export async function saveSlip(slip: SlipSmithSlip): Promise<void> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping saveSlip');
    return;
  }

  const data = {
    ...slip,
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    const db = (window as any).db;
    await db.collection('slips').doc(slip.slip_id).set(data, { merge: true });
  } else if (adminDb) {
    await adminDb.collection('slips').doc(slip.slip_id).set(data, { merge: true });
  } else {
    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = toFirestoreValue(value);
    }
    await firestoreRestRequest('PATCH', `slips/${slip.slip_id}?updateMask.fieldPaths=*`, { fields });
  }

  console.log(`Saved slip: ${slip.slip_id}`);
}

/**
 * Get a slip from Firestore
 */
export async function getSlip(slipId: string): Promise<SlipSmithSlip | null> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized');
    return null;
  }

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    const db = (window as any).db;
    const doc = await db.collection('slips').doc(slipId).get();
    return doc.exists ? (doc.data() as SlipSmithSlip) : null;
  } else if (adminDb) {
    const doc = await adminDb.collection('slips').doc(slipId).get();
    return doc.exists ? (doc.data() as SlipSmithSlip) : null;
  } else {
    try {
      const response = await firestoreRestRequest('GET', `slips/${slipId}`);
      return fromFirestoreDocument(response) as SlipSmithSlip;
    } catch {
      return null;
    }
  }
}

/**
 * List slips with optional filters
 */
export async function listSlips(options?: {
  date?: string;
  sport?: string;
  tier?: string;
  limit?: number;
}): Promise<SlipSmithSlip[]> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized');
    return [];
  }

  let slips: SlipSmithSlip[] = [];

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    const db = (window as any).db;
    let query = db.collection('slips').orderBy('created_at', 'desc');
    if (options?.limit) query = query.limit(options.limit);
    const snapshot = await query.get();
    slips = snapshot.docs.map((doc: any) => doc.data() as SlipSmithSlip);
  } else if (adminDb) {
    let query = adminDb.collection('slips').orderBy('created_at', 'desc');
    if (options?.limit) query = query.limit(options.limit);
    const snapshot = await query.get();
    slips = snapshot.docs.map((doc: any) => doc.data() as SlipSmithSlip);
  } else {
    // REST API - simple list without ordering
    const response = await firestoreRestRequest('GET', 'slips');
    if (response.documents) {
      slips = response.documents.map((doc: any) => fromFirestoreDocument(doc) as SlipSmithSlip);
    }
  }

  // Apply filters client-side
  if (options?.date) {
    slips = slips.filter((s) => s.date === options.date);
  }
  if (options?.sport) {
    slips = slips.filter((s) => s.sport?.toUpperCase() === options.sport?.toUpperCase());
  }
  if (options?.tier) {
    slips = slips.filter((s) => s.tier?.toLowerCase() === options.tier?.toLowerCase());
  }

  return slips;
}

// ============================================================================
// Players Ledger Operations
// ============================================================================

/**
 * Update the players reliability ledger
 */
export async function updatePlayersLedger(updates: PlayerLedgerUpdate[]): Promise<void> {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping updatePlayersLedger');
    return;
  }

  for (const update of updates) {
    const existing = await getPlayerLedger(update.playerId);
    
    const isDecided = update.result === 'hit' || update.result === 'miss';
    const newTotalBets = (existing?.total_bets ?? 0) + (isDecided ? 1 : 0);
    const newHits = (existing?.hits ?? 0) + (update.result === 'hit' ? 1 : 0);
    const newMisses = (existing?.misses ?? 0) + (update.result === 'miss' ? 1 : 0);
    const newPushes = (existing?.pushes ?? 0) + (update.result === 'push' ? 1 : 0);
    const newVoids = (existing?.voids ?? 0) + (update.result === 'void' ? 1 : 0);
    const newHitRate = (newHits + newMisses) > 0 ? newHits / (newHits + newMisses) : 0;

    // Update market-specific stats
    const markets = existing?.markets ?? {};
    const marketKey = update.market;
    const existingMarket = markets[marketKey] ?? { total: 0, hits: 0, misses: 0, hit_rate: 0, average_edge: 0 };

    if (isDecided) {
      const newMarketTotal = existingMarket.total + 1;
      const newMarketHits = existingMarket.hits + (update.result === 'hit' ? 1 : 0);
      const newMarketMisses = existingMarket.misses + (update.result === 'miss' ? 1 : 0);
      markets[marketKey] = {
        total: newMarketTotal,
        hits: newMarketHits,
        misses: newMarketMisses,
        hit_rate: newMarketHits / (newMarketHits + newMarketMisses),
        average_edge: (existingMarket.average_edge * existingMarket.total + update.edge) / newMarketTotal,
      };
    }

    const ledgerData: PlayerLedger = {
      player_id: update.playerId,
      total_bets: newTotalBets,
      hits: newHits,
      misses: newMisses,
      pushes: newPushes,
      voids: newVoids,
      hit_rate: newHitRate,
      markets,
      last_updated: new Date(),
    };

    if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
      const db = (window as any).db;
      await db.collection('players_ledger').doc(update.playerId).set(ledgerData, { merge: true });
    } else if (adminDb) {
      await adminDb.collection('players_ledger').doc(update.playerId).set(ledgerData, { merge: true });
    } else {
      const fields: Record<string, any> = {};
      for (const [key, value] of Object.entries(ledgerData)) {
        fields[key] = toFirestoreValue(value);
      }
      await firestoreRestRequest('PATCH', `players_ledger/${update.playerId}?updateMask.fieldPaths=*`, { fields });
    }
  }

  console.log(`Updated ledger for ${updates.length} players`);
}

/**
 * Get player ledger data
 */
export async function getPlayerLedger(playerId: string): Promise<PlayerLedger | null> {
  if (!firebaseInitialized) {
    return null;
  }

  if (ENV === 'browser' && typeof window !== 'undefined' && (window as any).db) {
    const db = (window as any).db;
    const doc = await db.collection('players_ledger').doc(playerId).get();
    return doc.exists ? (doc.data() as PlayerLedger) : null;
  } else if (adminDb) {
    const doc = await adminDb.collection('players_ledger').doc(playerId).get();
    return doc.exists ? (doc.data() as PlayerLedger) : null;
  } else {
    try {
      const response = await firestoreRestRequest('GET', `players_ledger/${playerId}`);
      return fromFirestoreDocument(response) as PlayerLedger;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a slip ID in the standard format
 */
export function generateSlipId(sport: string, date: string, tier: string): string {
  const [year, month, day] = date.split('-');
  return `${sport.toUpperCase()}_${year}_${month}_${day}_${tier.toUpperCase()}`;
}

/**
 * Close Firebase connection (for cleanup)
 */
export async function closeFirebase(): Promise<void> {
  if (adminApp) {
    await adminApp.delete();
    adminApp = null;
    adminDb = null;
  }
  firebaseInitialized = false;
  firebaseConfig = null;
  console.log('Firebase connection closed');
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  initializeFirebase,
  isFirebaseAvailable,
  getFirestore,
  saveProjections,
  getProjections,
  saveResults,
  getResults,
  saveSlip,
  getSlip,
  listSlips,
  updatePlayersLedger,
  getPlayerLedger,
  generateSlipId,
  closeFirebase,
};

/**
 * SlipSmith Projection Engine - Main Entry Point
 * 
 * Multi-sport projection engine for generating box score projections
 * and identifying high-edge betting opportunities.
 */

import * as dotenv from 'dotenv';
import { createApiServer } from './api';
import { ProviderConfig } from './providers';

// Load environment variables
dotenv.config();

// Configuration from environment
const config: ProviderConfig = {
  basketballApiKey: process.env.BASKETBALL_API_KEY,
  footballApiKey: process.env.FOOTBALL_API_KEY,
  soccerApiKey: process.env.SOCCER_API_KEY,
  esportsApiKey: process.env.ESPORTS_API_KEY,
  useMockData: process.env.USE_MOCK_DATA === 'true',
};

const port = parseInt(process.env.PORT ?? '3001', 10);
const dbPath = process.env.DB_PATH ?? './data/slipsmith.db';

// Create and start server
const server = createApiServer({
  port,
  dbPath,
  providerConfig: config,
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  server.close();
  process.exit(0);
});

// Start the server
server.start();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           🎯 SlipSmith Projection Engine v1.0.0 🎯           ║
║                                                              ║
║   Multi-Sport Projection Brain for NBA, NFL, Soccer & More  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

API Endpoints:
  GET  /health                            - Health check
  GET  /api/sports                        - Get supported sports and leagues
  GET  /api/schedule/:league/:date        - Get schedule for a date
  GET  /api/projections/:league/:date     - Generate projections
  GET  /api/events/:league/:date          - Get top events (legacy format)
  GET  /api/top-events?date=...&sport=... - Get top events (SlipSmith format)
  POST /api/evaluate/:date                - Evaluate past predictions
  GET  /api/summary                       - Get evaluation summary
  GET  /api/reliability                   - Get reliability report

Example:
  curl http://localhost:${port}/api/projections/NBA/2024-01-15
  curl "http://localhost:${port}/api/top-events?date=2024-01-15&sport=NBA&tier=vip"
`);

export { createApiServer };

// Re-export SlipService for programmatic access
export { SlipService, getTopEvents } from './engine';
export type { GetTopEventsOptions, SlipServiceConfig } from './engine';
export type { SlipSmithSlip, SlipEvent, SlipTier } from './types';

/**
 * Cloudflare Pages Function - Catch-all API handler
 * 
 * This file serves as the catch-all route handler for all /api/* paths.
 * It imports and delegates to the main api.ts handler.
 * 
 * File naming convention: [[path]].ts captures all routes under /api/*
 */

export { onRequest } from '../api';

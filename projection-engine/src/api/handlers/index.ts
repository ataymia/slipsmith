/**
 * API Handlers Index
 * 
 * Central export point for all API handlers.
 * These handlers work across Express (Node.js) and Cloudflare Workers.
 */

// Types
export type {
  EnvBindings,
  HandlerContext,
  ApiResponse,
  ProjectionsParams,
  EventsParams,
  TopEventsParams,
  EvaluateParams,
  SummaryParams,
  ProviderConfigFromEnv,
} from './types';

export {
  isMockMode,
  hasRequiredKeys,
  getMissingKeysMessage,
  getProviderConfig,
} from './types';

// Projections
export { handleProjections } from './projections';
export type { ProjectionsResult } from './projections';

// Events
export { handleEvents, handleTopEvents } from './events';
export type { EventsResult, TopEventsResult } from './events';

// Sports
export { handleSports, handleSchedule } from './sports';
export type { SportsResult, ScheduleResult } from './sports';

// Summary
export { handleSummary, handleEvaluate } from './summary';
export type { SummaryResult, EvaluateResult } from './summary';

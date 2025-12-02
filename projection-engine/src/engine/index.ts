/**
 * Engine Index
 * 
 * Central export point for the projection engine components.
 */

export { ProjectionEngine } from './ProjectionEngine';
export { EdgeDetector } from './EdgeDetector';
export { 
  SlipService, 
  getTopEvents,
  getRequiredMinByLeague,
  SLIPSMITH_MIN_PROBABILITY,
  GREEN_PROBABILITY_THRESHOLD,
} from './SlipService';
export type { ProjectionConfig } from './ProjectionEngine';
export type { EdgeConfig } from './EdgeDetector';
export type { GetTopEventsOptions, SlipServiceConfig } from './SlipService';

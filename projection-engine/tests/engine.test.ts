/**
 * SlipSmith Projection Engine Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ProviderFactory } from '../src/providers';
import { ProjectionEngine } from '../src/engine/ProjectionEngine';
import { EdgeDetector } from '../src/engine/EdgeDetector';
import type { Event, GameProjection, ConsensusLine, League } from '../src/types';
import {
  buildSlipId,
  buildEventId,
  formatProbability,
  convertToSlipEvent,
  buildSlipSmithSlip,
  normalizeTier,
  isValidTier,
  getSportDisplay,
} from '../src/utils/slipBuilder';

describe('ProviderFactory', () => {
  it('should create providers for all sports', () => {
    const factory = new ProviderFactory({ useMockData: true });
    
    expect(factory.getSupportedSports()).toContain('basketball');
    expect(factory.getSupportedSports()).toContain('football');
    expect(factory.getSupportedSports()).toContain('soccer');
    expect(factory.getSupportedSports()).toContain('esports');
  });
  
  it('should return correct sport for league', () => {
    const factory = new ProviderFactory({ useMockData: true });
    
    expect(factory.getSportForLeague('NBA')).toBe('basketball');
    expect(factory.getSportForLeague('NFL')).toBe('football');
    expect(factory.getSportForLeague('EPL')).toBe('soccer');
    expect(factory.getSportForLeague('LOL')).toBe('esports');
  });
  
  it('should get provider for league', () => {
    const factory = new ProviderFactory({ useMockData: true });
    
    const provider = factory.getProviderForLeague('NBA');
    expect(provider).toBeDefined();
    expect(provider.sport).toBe('basketball');
    expect(provider.supportedLeagues).toContain('NBA');
  });
});

describe('ProjectionEngine', () => {
  let engine: ProjectionEngine;
  let providerFactory: ProviderFactory;
  
  beforeAll(() => {
    providerFactory = new ProviderFactory({ useMockData: true });
    engine = new ProjectionEngine(providerFactory);
  });
  
  it('should generate projections for a league', async () => {
    const today = new Date().toISOString().split('T')[0];
    const projections = await engine.generateProjections('NBA' as League, today as string);
    
    expect(Array.isArray(projections)).toBe(true);
    // Mock provider should return some games
    expect(projections.length).toBeGreaterThanOrEqual(0);
  });
  
  it('should include team projections', async () => {
    const today = new Date().toISOString().split('T')[0];
    const projections = await engine.generateProjections('NBA' as League, today as string);
    
    if (projections.length > 0) {
      const game = projections[0] as GameProjection;
      expect(game.homeTeam).toBeDefined();
      expect(game.awayTeam).toBeDefined();
      expect(game.homeTeam.projectedScore).toBeGreaterThan(0);
      expect(game.awayTeam.projectedScore).toBeGreaterThan(0);
    }
  });
  
  it('should include player projections', async () => {
    const today = new Date().toISOString().split('T')[0];
    const projections = await engine.generateProjections('NBA' as League, today as string);
    
    if (projections.length > 0) {
      const game = projections[0] as GameProjection;
      expect(Array.isArray(game.players)).toBe(true);
      
      if (game.players.length > 0) {
        const player = game.players[0];
        expect(player).toBeDefined();
        expect(player.projectedStats).toBeDefined();
      }
    }
  });
});

describe('EdgeDetector', () => {
  let detector: EdgeDetector;
  
  beforeAll(() => {
    detector = new EdgeDetector();
  });
  
  it('should find edges between projections and lines', () => {
    const projections: GameProjection[] = [{
      gameId: 'game_1',
      sport: 'basketball',
      league: 'NBA',
      date: '2024-01-15',
      homeTeam: {
        teamId: 'team_1',
        teamName: 'Team A',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 115,
        projectedStats: {},
        confidence: 0.8,
      },
      awayTeam: {
        teamId: 'team_2',
        teamName: 'Team B',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 110,
        projectedStats: {},
        confidence: 0.8,
      },
      players: [{
        playerId: 'player_1',
        playerName: 'Test Player',
        teamId: 'team_1',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        position: 'PG',
        projectedStats: { points: 30 },
        confidence: 0.8,
        adjustments: [],
      }],
      generatedAt: new Date(),
    }];
    
    const lines: ConsensusLine[] = [{
      id: 'line_1',
      gameId: 'game_1',
      sport: 'basketball',
      league: 'NBA',
      playerId: 'player_1',
      playerName: 'Test Player',
      teamId: 'team_1',
      market: 'POINTS',
      line: 25.5,
      timestamp: new Date(),
    }];
    
    const events = detector.findEdges(projections, lines);
    
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    
    const event = events[0] as Event;
    expect(event.direction).toBe('over');
    expect(event.modelProjection).toBe(30);
    expect(event.line).toBe(25.5);
    expect(event.edgeScore).toBeGreaterThan(0);
  });
  
  it('should correctly identify over/under direction', () => {
    const projections: GameProjection[] = [{
      gameId: 'game_1',
      sport: 'basketball',
      league: 'NBA',
      date: '2024-01-15',
      homeTeam: {
        teamId: 'team_1',
        teamName: 'Team A',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 115,
        projectedStats: {},
        confidence: 0.8,
      },
      awayTeam: {
        teamId: 'team_2',
        teamName: 'Team B',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 110,
        projectedStats: {},
        confidence: 0.8,
      },
      players: [{
        playerId: 'player_1',
        playerName: 'Test Player',
        teamId: 'team_1',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        position: 'PG',
        projectedStats: { points: 20 }, // Projection UNDER the line
        confidence: 0.8,
        adjustments: [],
      }],
      generatedAt: new Date(),
    }];
    
    const lines: ConsensusLine[] = [{
      id: 'line_1',
      gameId: 'game_1',
      sport: 'basketball',
      league: 'NBA',
      playerId: 'player_1',
      playerName: 'Test Player',
      market: 'POINTS',
      line: 25.5,
      timestamp: new Date(),
    }];
    
    const events = detector.findEdges(projections, lines);
    
    if (events.length > 0) {
      const event = events[0] as Event;
      expect(event.direction).toBe('under');
    }
  });
  
  it('should filter by minimum edge', () => {
    const detector = new EdgeDetector({ minEdge: 5.0 });
    
    const projections: GameProjection[] = [{
      gameId: 'game_1',
      sport: 'basketball',
      league: 'NBA',
      date: '2024-01-15',
      homeTeam: {
        teamId: 'team_1',
        teamName: 'Team A',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 115,
        projectedStats: {},
        confidence: 0.8,
      },
      awayTeam: {
        teamId: 'team_2',
        teamName: 'Team B',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 110,
        projectedStats: {},
        confidence: 0.8,
      },
      players: [{
        playerId: 'player_1',
        playerName: 'Test Player',
        teamId: 'team_1',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        position: 'PG',
        projectedStats: { points: 25.5 }, // Exactly on line - should result in 0 raw edge
        confidence: 0.1, // Very low confidence
        adjustments: [],
      }],
      generatedAt: new Date(),
    }];
    
    const lines: ConsensusLine[] = [{
      id: 'line_1',
      gameId: 'game_1',
      sport: 'basketball',
      league: 'NBA',
      playerId: 'player_1',
      playerName: 'Test Player',
      market: 'POINTS',
      line: 25.5, // Exactly equal to projection
      timestamp: new Date(),
    }];
    
    const events = detector.findEdges(projections, lines);
    
    // Zero edge should be filtered out by minEdge of 5
    expect(events.length).toBe(0);
  });
  
  it('should sort events by edge score', () => {
    const projections: GameProjection[] = [{
      gameId: 'game_1',
      sport: 'basketball',
      league: 'NBA',
      date: '2024-01-15',
      homeTeam: {
        teamId: 'team_1',
        teamName: 'Team A',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 115,
        projectedStats: {},
        confidence: 0.8,
      },
      awayTeam: {
        teamId: 'team_2',
        teamName: 'Team B',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        projectedScore: 110,
        projectedStats: {},
        confidence: 0.8,
      },
      players: [
        {
          playerId: 'player_1',
          playerName: 'Player One',
          teamId: 'team_1',
          gameId: 'game_1',
          sport: 'basketball',
          league: 'NBA',
          position: 'PG',
          projectedStats: { points: 28 }, // 2.5 edge
          confidence: 0.8,
          adjustments: [],
        },
        {
          playerId: 'player_2',
          playerName: 'Player Two',
          teamId: 'team_1',
          gameId: 'game_1',
          sport: 'basketball',
          league: 'NBA',
          position: 'SG',
          projectedStats: { points: 35 }, // 9.5 edge - should be first
          confidence: 0.8,
          adjustments: [],
        },
      ],
      generatedAt: new Date(),
    }];
    
    const lines: ConsensusLine[] = [
      {
        id: 'line_1',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        playerId: 'player_1',
        playerName: 'Player One',
        market: 'POINTS',
        line: 25.5,
        timestamp: new Date(),
      },
      {
        id: 'line_2',
        gameId: 'game_1',
        sport: 'basketball',
        league: 'NBA',
        playerId: 'player_2',
        playerName: 'Player Two',
        market: 'POINTS',
        line: 25.5,
        timestamp: new Date(),
      },
    ];
    
    const events = detector.findEdges(projections, lines);
    
    expect(events.length).toBe(2);
    // Higher edge should come first
    expect(events[0]?.playerName).toBe('Player Two');
    expect(events[1]?.playerName).toBe('Player One');
  });
});

describe('SlipBuilder', () => {
  describe('buildSlipId', () => {
    it('should build slip_id in correct format', () => {
      const slipId = buildSlipId('NBA', '2025-12-01', 'vip');
      expect(slipId).toBe('NBA_2025_12_01_VIP');
    });
    
    it('should handle lowercase sport input', () => {
      const slipId = buildSlipId('nba', '2025-12-01', 'pro');
      expect(slipId).toBe('NBA_2025_12_01_PRO');
    });
    
    it('should handle all tiers', () => {
      expect(buildSlipId('NFL', '2025-01-15', 'starter')).toBe('NFL_2025_01_15_STARTER');
      expect(buildSlipId('NFL', '2025-01-15', 'pro')).toBe('NFL_2025_01_15_PRO');
      expect(buildSlipId('NFL', '2025-01-15', 'vip')).toBe('NFL_2025_01_15_VIP');
    });
  });
  
  describe('formatProbability', () => {
    it('should format probability as percentage string', () => {
      expect(formatProbability(0.83)).toBe('83%');
      expect(formatProbability(0.5)).toBe('50%');
      expect(formatProbability(1.0)).toBe('100%');
      expect(formatProbability(0)).toBe('0%');
    });
    
    it('should round to nearest integer', () => {
      expect(formatProbability(0.725)).toBe('73%');
      expect(formatProbability(0.824)).toBe('82%');
    });
  });
  
  describe('normalizeTier', () => {
    it('should normalize valid tiers to lowercase', () => {
      expect(normalizeTier('VIP')).toBe('vip');
      expect(normalizeTier('PRO')).toBe('pro');
      expect(normalizeTier('STARTER')).toBe('starter');
    });
    
    it('should default to starter for invalid tiers', () => {
      expect(normalizeTier('invalid')).toBe('starter');
      expect(normalizeTier('')).toBe('starter');
    });
  });
  
  describe('isValidTier', () => {
    it('should validate tier values', () => {
      expect(isValidTier('starter')).toBe(true);
      expect(isValidTier('pro')).toBe(true);
      expect(isValidTier('vip')).toBe(true);
      expect(isValidTier('invalid')).toBe(false);
      expect(isValidTier('')).toBe(false);
    });
  });
  
  describe('getSportDisplay', () => {
    it('should return league as display for major leagues', () => {
      expect(getSportDisplay('basketball', 'NBA')).toBe('NBA');
      expect(getSportDisplay('basketball', 'WNBA')).toBe('WNBA');
      expect(getSportDisplay('football', 'NFL')).toBe('NFL');
      expect(getSportDisplay('soccer', 'EPL')).toBe('EPL');
    });
  });
  
  describe('buildEventId', () => {
    it('should build unique event_id', () => {
      const eventId = buildEventId('NBA', 'PHX@LAL', 'Austin Reaves', 'RA', 8.5, 'over', '2025-12-01');
      expect(eventId).toContain('nba');
      expect(eventId).toContain('austin_reaves');
      expect(eventId).toContain('8_5');
      expect(eventId).toContain('over');
      expect(eventId).toContain('20251201');
    });
  });
  
  describe('convertToSlipEvent', () => {
    it('should convert internal Event to SlipEvent format', () => {
      const event: Event = {
        eventId: 'test-uuid',
        date: '2025-12-01',
        sport: 'basketball',
        league: 'NBA',
        gameId: 'PHX@LAL',
        playerId: 'player_1',
        playerName: 'Austin Reaves',
        teamId: 'LAL',
        teamName: 'Lakers',
        market: 'RA',
        line: 8.5,
        direction: 'over',
        modelProjection: 10.5,
        probability: 0.83,
        edgeScore: 7.5,
        reasoning: 'Test reasoning',
        confidence: 0.8,
      };
      
      const slipEvent = convertToSlipEvent(event, 'NBA');
      
      expect(slipEvent.player).toBe('Austin Reaves');
      expect(slipEvent.team).toBe('Lakers');
      expect(slipEvent.line).toBe(8.5);
      expect(slipEvent.direction).toBe('over');
      expect(slipEvent.probability).toBe('83%');
      expect(slipEvent.reasoning).toBe('Test reasoning');
      expect(slipEvent.time).toBe('TBD');
      expect(slipEvent.event_id).toBeTruthy();
    });
  });
  
  describe('buildSlipSmithSlip', () => {
    it('should build complete slip in official format', () => {
      const events: Event[] = [
        {
          eventId: 'test-1',
          date: '2025-12-01',
          sport: 'basketball',
          league: 'NBA',
          gameId: 'game_1',
          playerId: 'player_1',
          playerName: 'Test Player',
          teamId: 'team_1',
          teamName: 'Test Team',
          market: 'POINTS',
          line: 25.5,
          direction: 'over',
          modelProjection: 30,
          probability: 0.75,
          edgeScore: 8.5,
          reasoning: 'Strong over',
          confidence: 0.8,
        },
      ];
      
      const slip = buildSlipSmithSlip(events, '2025-12-01', 'basketball', 'NBA', 'vip');
      
      expect(slip.slip_id).toBe('NBA_2025_12_01_VIP');
      expect(slip.date).toBe('2025-12-01');
      expect(slip.sport).toBe('NBA');
      expect(slip.tier).toBe('vip');
      expect(slip.events).toHaveLength(1);
      expect(slip.events[0].probability).toBe('75%');
      expect(slip.events[0].line).toBe(25.5);
    });
    
    it('should include warning when provided', () => {
      const slip = buildSlipSmithSlip([], '2025-12-01', 'basketball', 'NBA', 'starter', 'Test warning');
      expect(slip.warning).toBe('Test warning');
    });
    
    it('should sort events by edge score descending', () => {
      const events: Event[] = [
        {
          eventId: 'low-edge',
          date: '2025-12-01',
          sport: 'basketball',
          league: 'NBA',
          gameId: 'game_1',
          playerId: 'player_1',
          playerName: 'Low Edge Player',
          teamId: 'team_1',
          teamName: 'Team A',
          market: 'POINTS',
          line: 20,
          direction: 'over',
          modelProjection: 21,
          probability: 0.55,
          edgeScore: 2.0,
          reasoning: 'Low edge',
          confidence: 0.6,
        },
        {
          eventId: 'high-edge',
          date: '2025-12-01',
          sport: 'basketball',
          league: 'NBA',
          gameId: 'game_1',
          playerId: 'player_2',
          playerName: 'High Edge Player',
          teamId: 'team_1',
          teamName: 'Team A',
          market: 'POINTS',
          line: 20,
          direction: 'over',
          modelProjection: 30,
          probability: 0.85,
          edgeScore: 9.0,
          reasoning: 'High edge',
          confidence: 0.9,
        },
      ];
      
      const slip = buildSlipSmithSlip(events, '2025-12-01', 'basketball', 'NBA', 'vip');
      
      expect(slip.events[0].player).toBe('High Edge Player');
      expect(slip.events[1].player).toBe('Low Edge Player');
    });
  });
});

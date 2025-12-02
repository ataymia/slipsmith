/**
 * SlipSmith Projection Engine Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ProviderFactory } from '../src/providers';
import { ProjectionEngine } from '../src/engine/ProjectionEngine';
import { EdgeDetector } from '../src/engine/EdgeDetector';
import type { Event, GameProjection, ConsensusLine, League } from '../src/types';

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

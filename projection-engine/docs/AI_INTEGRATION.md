# AI Integration Guide

This document explains how AI can be integrated into the SlipSmith Projection Engine for enhanced reasoning, explanation, and analysis.

## Table of Contents

1. [Overview](#overview)
2. [AI Use Cases](#ai-use-cases)
3. [Where AI Adds Value](#where-ai-adds-value)
4. [Where AI Should NOT Be Used](#where-ai-should-not-be-used)
5. [Implementation Guide](#implementation-guide)
6. [Suggested Providers](#suggested-providers)
7. [Content Guidelines](#content-guidelines)

---

## Overview

AI integration in SlipSmith serves to enhance the user experience through:
- Natural language explanations
- Trend analysis and summarization
- Matchup context and narrative
- Educational content generation

**Critical Principle:** AI is used for explanation and communication, NOT for core data validation or projection calculations.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       AI Integration Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐ │
│   │  Projection     │────▶│   AI Service    │────▶│  Enhanced Output │ │
│   │  Engine Output  │     │   (Reasoning)   │     │  with Reasoning  │ │
│   └─────────────────┘     └─────────────────┘     └──────────────────┘ │
│                                                                          │
│   ✅ AI CAN:                        ❌ AI CANNOT:                       │
│   • Explain projections             • Calculate projections             │
│   • Summarize trends                • Validate schedules                │
│   • Provide matchup context         • Determine injury status           │
│   • Generate educational content    • Override consensus lines          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AI Use Cases

### 1. Reasoning Generation

Transform dry projection data into readable explanations.

**Input:**
```json
{
  "player": "Stephen Curry",
  "market": "POINTS",
  "line": 27.5,
  "projection": 31.2,
  "direction": "over",
  "edge": 3.7,
  "adjustments": [
    { "type": "matchup", "factor": 1.1, "description": "LAL allows most 3PA" },
    { "type": "trend", "factor": 1.05, "description": "30+ pts in 4 of 5" }
  ]
}
```

**AI Output:**
```
"Stephen Curry projects to 31.2 points, comfortably over the 27.5 line. 
The Lakers allow the most three-point attempts in the league, playing 
right into Curry's strengths. He's been scorching hot lately, topping 
30 points in 4 of his last 5 games. Look for him to continue his dominant 
stretch in this marquee matchup."
```

### 2. Matchup Summarization

Provide context about game matchups.

**Input:**
```json
{
  "homeTeam": "Golden State Warriors",
  "awayTeam": "Los Angeles Lakers",
  "sport": "NBA",
  "projectedScore": "GSW 118 - LAL 112",
  "keyFactors": [
    "GSW 12-3 at home this season",
    "Lakers on 2nd night of back-to-back",
    "LeBron questionable with ankle"
  ]
}
```

**AI Output:**
```
"The Warriors host a fatigued Lakers squad in what could be a lopsided 
affair. Golden State is a stellar 12-3 at Chase Center, while LA comes 
in on the second night of a back-to-back with LeBron's status uncertain. 
Our model projects a GSW victory 118-112, but monitor LeBron's status 
as it could swing the total significantly."
```

### 3. Trend Analysis

Explain recent performance patterns.

```
"Luka Doncic has been dominant in January, averaging 35.2 PPG on 52% 
shooting. His usage rate has spiked to 38% with Kyrie Irving managing 
load, making his points prop an attractive target. Note: His home/away 
split is extreme (37 PPG home, 31 PPG road)."
```

### 4. Educational Explanations

Help users understand the methodology.

```
"Edge Score Explained: The 6.4 edge score indicates a moderately strong 
discrepancy between our projection (29.5) and the line (26.5). We calculate 
this using historical accuracy (68% hit rate for this player on points), 
model confidence (78%), and the raw edge (3 points). Scores above 5 
historically hit at 58%."
```

---

## Where AI Adds Value

### ✅ Safe AI Applications

| Use Case | Description | Implementation |
|----------|-------------|----------------|
| **Reasoning** | Natural language explanations | Post-process event output |
| **Summaries** | Game/day summaries | Aggregate and summarize |
| **Trends** | Performance pattern analysis | Analyze historical data |
| **Education** | Explain methodology | Static content + context |
| **Formatting** | Presentation enhancement | Style and structure |

### Example: Reasoning Generator

```typescript
async function generateReasoning(event: Event): Promise<string> {
  const prompt = `
    Generate a concise betting analysis (2-3 sentences) for this event:
    
    Player: ${event.playerName}
    Market: ${event.market}
    Line: ${event.line}
    Model Projection: ${event.modelProjection}
    Direction: ${event.direction}
    Edge Score: ${event.edgeScore}
    
    Rules:
    - Be factual and analytical
    - Do not give betting advice
    - Explain the key factors
    - Keep it under 100 words
  `;
  
  const response = await aiClient.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.7,
  });
  
  return response.choices[0].message.content;
}
```

---

## Where AI Should NOT Be Used

### ❌ Prohibited AI Applications

| Area | Reason | Correct Approach |
|------|--------|------------------|
| **Schedule data** | Factual, verifiable | Use official APIs |
| **Injury status** | Time-sensitive, critical | Use official sources |
| **Roster data** | Must be accurate | Use team APIs |
| **Line values** | Financial implications | Use verified sources |
| **Projections** | Core algorithm | Use structured model |
| **Win/loss grading** | Must match actuals | Compare to box scores |

### Why This Matters

1. **Accuracy**: AI can hallucinate facts, especially about recent events
2. **Timeliness**: AI knowledge has a cutoff date
3. **Liability**: Incorrect data could affect decisions
4. **Reproducibility**: AI outputs vary; projections must be consistent

### Example: What NOT to Do

```typescript
// ❌ WRONG - Don't use AI for factual data
const badExample = await ai.chat("Is LeBron James playing tonight?");

// ✅ CORRECT - Use official API
const injuryReport = await espn.getInjuryReport('NBA');
const lebronStatus = injuryReport.find(p => p.name === 'LeBron James');
```

---

## Implementation Guide

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Request Flow                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Generate Projections (NO AI)                               │
│       │                                                         │
│       ▼                                                         │
│   2. Calculate Edges (NO AI)                                    │
│       │                                                         │
│       ▼                                                         │
│   3. Enhance with AI Reasoning (AI OK)                          │
│       │                                                         │
│       ▼                                                         │
│   4. Return Enhanced Response                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### AI Service Module

```typescript
// src/services/AIService.ts

import OpenAI from 'openai';

export class AIService {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  /**
   * Generate reasoning for an event
   */
  async generateEventReasoning(event: Event): Promise<string> {
    const prompt = this.buildReasoningPrompt(event);
    
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      });
      
      return response.choices[0]?.message?.content ?? this.fallbackReasoning(event);
    } catch (error) {
      console.error('AI reasoning failed:', error);
      return this.fallbackReasoning(event);
    }
  }
  
  /**
   * Summarize a game matchup
   */
  async summarizeMatchup(game: GameProjection): Promise<string> {
    // Implementation
  }
  
  /**
   * Fallback when AI is unavailable
   */
  private fallbackReasoning(event: Event): string {
    const edge = Math.abs(event.modelProjection - event.line);
    return `${event.playerName} projects to ${event.modelProjection.toFixed(1)} ${event.market.toLowerCase()}, `
      + `${event.direction === 'over' ? 'above' : 'below'} the ${event.line} line by ${edge.toFixed(1)} units.`;
  }
  
  private buildReasoningPrompt(event: Event): string {
    return `
Analyze this sports betting event and provide a brief, factual explanation:

Sport: ${event.sport}
Player: ${event.playerName}
Market: ${event.market}
Line: ${event.line}
Model Projection: ${event.modelProjection}
Direction: ${event.direction.toUpperCase()}
Edge Score: ${event.edgeScore.toFixed(2)}
Probability: ${(event.probability * 100).toFixed(0)}%

Generate 2-3 sentences explaining:
1. Why the projection differs from the line
2. Key factors to consider
3. Any relevant context

Keep the tone analytical, not promotional. Do not recommend betting.
    `.trim();
  }
}

const SYSTEM_PROMPT = `
You are a sports analytics assistant. Provide factual, analytical explanations 
for sports projections. Your role is educational - help users understand the 
reasoning behind projections.

Rules:
- Be concise (under 100 words)
- Be factual and analytical
- Do NOT provide betting advice
- Do NOT guarantee outcomes
- Acknowledge uncertainty when relevant
`.trim();
```

### Integration with Events

```typescript
// In EdgeDetector or API layer

async function enhanceEventsWithAI(events: Event[]): Promise<Event[]> {
  const aiService = new AIService(process.env.OPENAI_API_KEY);
  
  // Process in parallel with rate limiting
  const enhanced = await Promise.all(
    events.map(async (event, index) => {
      // Rate limit: 10 requests per second
      await delay(index * 100);
      
      const aiReasoning = await aiService.generateEventReasoning(event);
      
      return {
        ...event,
        reasoning: aiReasoning,
      };
    })
  );
  
  return enhanced;
}
```

---

## Suggested Providers

### 1. OpenAI (Recommended)

**Models:**
- `gpt-4-turbo-preview` - Best quality, higher cost
- `gpt-3.5-turbo` - Faster, cheaper, good for most cases

**Pricing (as of 2024):**
- GPT-4 Turbo: $0.01/1K input, $0.03/1K output
- GPT-3.5 Turbo: $0.0005/1K input, $0.0015/1K output

**Setup:**
```bash
npm install openai
export OPENAI_API_KEY=sk-...
```

### 2. Anthropic Claude

**Models:**
- `claude-3-sonnet` - Good balance of quality and speed
- `claude-3-haiku` - Fastest, cheapest

**Setup:**
```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY=...
```

### 3. Local Models (Ollama)

For privacy-conscious or offline usage:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Run Mistral 7B
ollama run mistral
```

**Integration:**
```typescript
const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    model: 'mistral',
    prompt: reasoningPrompt,
  }),
});
```

---

## Content Guidelines

### 1. Educational, Not Advisory

✅ **Good:**
> "Our model projects Curry at 31 points based on recent shooting trends and favorable matchup against LAL's perimeter defense."

❌ **Bad:**
> "Curry is a lock for over 27.5 points. Take this bet!"

### 2. Acknowledge Uncertainty

✅ **Good:**
> "While the edge appears strong at 4.2 points, note that Curry's variance is high (SD: 8.2 points)."

❌ **Bad:**
> "This projection is guaranteed to hit."

### 3. Factual Basis

✅ **Good:**
> "The projection accounts for LAL's #30 ranked perimeter defense and Curry's 35 PPG over last 5 games."

❌ **Bad:**
> "Curry always destroys the Lakers."

### 4. Responsible Language

Include disclaimers in all AI-generated content:

```typescript
const disclaimer = `
This analysis is for informational and educational purposes only. 
Past performance does not guarantee future results. 
Please gamble responsibly.
`;
```

---

## Environment Variables

```bash
# AI Provider Configuration
AI_PROVIDER=openai  # or 'anthropic', 'local'
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...

# Feature Flags
ENABLE_AI_REASONING=true
AI_REASONING_BATCH_SIZE=10
AI_REQUESTS_PER_SECOND=5
```

---

## Testing AI Integration

```typescript
// tests/ai.test.ts

describe('AIService', () => {
  it('should generate valid reasoning', async () => {
    const event = createMockEvent({
      playerName: 'Stephen Curry',
      market: 'POINTS',
      line: 27.5,
      modelProjection: 31.2,
    });
    
    const reasoning = await aiService.generateEventReasoning(event);
    
    expect(reasoning).toContain('Curry');
    expect(reasoning.length).toBeLessThan(500);
    expect(reasoning).not.toContain('guarantee');
    expect(reasoning).not.toContain('lock');
  });
  
  it('should fallback gracefully on API error', async () => {
    // Mock API failure
    jest.spyOn(aiClient, 'chat').mockRejectedValue(new Error('API Error'));
    
    const reasoning = await aiService.generateEventReasoning(event);
    
    expect(reasoning).toBeTruthy();
    expect(reasoning).toContain(event.playerName);
  });
});
```

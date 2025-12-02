# Cloudflare Pages Deployment Guide

This guide explains how to deploy the SlipSmith Projection Engine to Cloudflare Pages.

## Overview

The projection engine can be deployed in two ways:

1. **Cloudflare Pages Function** - Serverless deployment using Cloudflare Workers runtime
2. **Node.js Express Server** - Traditional server deployment (for local development)

## Local Development with Wrangler

### Prerequisites

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. (Optional) Create a Cloudflare account and log in:
   ```bash
   wrangler login
   ```

### Running Locally

**Option 1: Using wrangler pages dev**

This runs the Cloudflare Pages Function locally, simulating the production environment:

```bash
# From the repository root
wrangler pages dev ./projection-engine/frontend

# Or with environment bindings
wrangler pages dev ./projection-engine/frontend \
  --binding USE_MOCK_DATA=true \
  --binding FIREBASE_PROJECT_ID=your-project-id
```

**Option 2: Using the Express server (Node.js)**

For local development with the full Node.js environment:

```bash
cd projection-engine
npm install
npm run dev
```

### Testing the API

Once running, test the API:

```bash
# Health check
curl http://localhost:8788/api/health

# Get projections
curl http://localhost:8788/api/projections/NBA/2024-12-01

# Get top events
curl "http://localhost:8788/api/top-events?date=2024-12-01&sport=NBA&tier=vip"
```

## Deploying to Cloudflare Pages

### Method 1: GitHub Integration (Recommended)

1. Push your code to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Navigate to **Pages** → **Create a project** → **Connect to Git**
4. Select your repository
5. Configure build settings:
   - **Framework preset**: None
   - **Build command**: (leave empty or `echo "No build needed"`)
   - **Build output directory**: `projection-engine/frontend`
6. Add environment variables (see below)
7. Click **Save and Deploy**

### Method 2: Direct Upload

```bash
# Build (if needed)
cd projection-engine && npm run build

# Deploy
wrangler pages publish ./projection-engine/frontend --project-name=slipsmith
```

### Method 3: Using wrangler.toml

Create a `wrangler.toml` in the repository root:

```toml
name = "slipsmith"
pages_build_output_dir = "projection-engine/frontend"

[vars]
USE_MOCK_DATA = "true"

# Add other non-secret variables here
```

Then deploy:

```bash
wrangler pages publish
```

## Environment Variables

### Required for Production

Set these in **Cloudflare Pages** → **Settings** → **Environment variables**:

| Variable | Description | Encrypt? |
|----------|-------------|----------|
| `USE_MOCK_DATA` | Set to `false` for production | No |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID | No |
| `FIREBASE_API_KEY` | Firebase Web API Key | Yes |
| `ODDS_API_KEY` | The Odds API key | Yes |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `BASKETBALL_API_KEY` | balldontlie.io API key |
| `FOOTBALL_API_KEY` | Football API key |
| `SOCCER_API_KEY` | API-Football key |
| `ESPORTS_API_KEY` | PandaScore API key |

See [docs/CONFIG_KEYS.md](./CONFIG_KEYS.md) for complete documentation.

## API Endpoints

The Cloudflare Pages Function exposes these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/sports` | Get supported sports and leagues |
| GET | `/api/schedule/:league/:date` | Get schedule for a date |
| GET | `/api/projections/:league/:date` | Generate projections |
| GET | `/api/events/:league/:date` | Get top events (legacy) |
| GET | `/api/top-events` | Get top events (SlipSmith format) |
| POST | `/api/evaluate/:date` | Evaluate past predictions |
| GET | `/api/summary` | Get evaluation summary |

### Example Requests

```bash
# Get projections for NBA on a specific date
curl https://slipsmith.pages.dev/api/projections/NBA/2024-12-01

# Get top events with tier and limit
curl "https://slipsmith.pages.dev/api/top-events?date=2024-12-01&sport=NBA&tier=vip&limit=10"
```

## Architecture Notes

### Differences from Express Server

The Cloudflare Pages Function has some limitations compared to the Node.js Express server:

1. **No SQLite**: The evaluation engine uses SQLite which is not available in Workers. Evaluation data should be stored in Firestore instead.

2. **No file system**: Workers don't have persistent file system access. All data must be stored in KV, D1, or external services like Firestore.

3. **Execution time limits**: Workers have a 30-second CPU time limit. Long-running operations should be optimized or moved to background jobs.

### Benefits

1. **Edge deployment**: API runs at the edge, close to users worldwide
2. **Auto-scaling**: Handles traffic spikes automatically
3. **No server management**: Zero infrastructure to maintain
4. **Integrated with Pages**: Static frontend and API deploy together

## Troubleshooting

### "Cannot find module" errors

The Pages Function uses a simplified implementation that doesn't import the full projection-engine modules. This is intentional to avoid Node.js-specific dependencies.

### API returns 500 errors

1. Check the Cloudflare Pages logs in the dashboard
2. Verify all required environment variables are set
3. Ensure `USE_MOCK_DATA=true` if API keys are not configured

### CORS errors

The API includes CORS headers for all origins. If you're still seeing CORS errors:
1. Check that your request is going to the correct URL
2. Verify the API is returning a successful response (not 500)

### Environment variables not working

1. Variable names are case-sensitive
2. Redeploy after adding/changing variables
3. Check both Production and Preview environments

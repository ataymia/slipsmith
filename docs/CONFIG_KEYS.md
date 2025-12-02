# SlipSmith Configuration Keys

This document describes all environment variables and bindings used by the SlipSmith Projection Engine.

## Quick Setup Checklist

1. **Copy the example env file** for local development:
   ```bash
   cp projection-engine/.env.example projection-engine/.env.local
   ```

2. **Start in mock mode** (no keys required):
   - The engine defaults to `USE_MOCK_DATA=true`
   - This allows you to test the UI and pipeline without any API keys

3. **Set up Firebase/Firestore** (recommended first):
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Get your Project ID and API Key
   - Add to `.env.local` and Cloudflare Variables

4. **Add sports data providers** as needed:
   - Sign up for sports data APIs (see provider list below)
   - Add keys to `.env.local` and Cloudflare Variables

5. **Add lines/odds providers** when ready:
   - Sign up for The Odds API or similar
   - Add keys to `.env.local` and Cloudflare Variables

6. **Disable mock mode for production**:
   - Set `USE_MOCK_DATA=false` in Cloudflare and `.env.local`
   - Verify all required keys are present

---

## Environment Variables Reference

### Mode Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `USE_MOCK_DATA` | Enable mock data mode. Set to `true` to use demo data without external APIs. | No | `true` |

**When `USE_MOCK_DATA=true` (default):**
- No external API calls are made
- Demo data is generated for testing
- Full pipeline is exercised (projections → edges → slips)
- Firestore writes still work if Firebase is configured

**When `USE_MOCK_DATA=false`:**
- Real API providers are used
- Required keys must be present or errors will occur

---

### Firebase / Firestore

Used for storing projections, slips, and evaluation data persistently.

| Variable | Description | Required for Production |
|----------|-------------|------------------------|
| `FIREBASE_PROJECT_ID` | Your Firebase project ID (e.g., `my-slipsmith-project`) | **Yes** |
| `FIREBASE_API_KEY` | Firebase Web API Key (for REST API mode in Workers) | Recommended |
| `FIREBASE_CLIENT_EMAIL` | Service account email (for Admin SDK in Node.js) | Optional |
| `FIREBASE_PRIVATE_KEY` | Service account private key (for Admin SDK) | Optional |

**Where to find these:**
- Firebase Console → Project Settings → General → Project ID
- Firebase Console → Project Settings → General → Web API Key
- Firebase Console → Project Settings → Service Accounts → Generate new private key

**Example `.env.local`:**
```env
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_API_KEY=AIza...your-api-key-here
```

---

### Sports Schedule & Stats Providers

These APIs provide game schedules, player stats, and box scores.

| Variable | Description | Sport | Required |
|----------|-------------|-------|----------|
| `BASKETBALL_API_KEY` | [balldontlie.io](https://www.balldontlie.io/) API key | Basketball (NBA, WNBA) | Optional (ESPN fallback) |
| `FOOTBALL_API_KEY` | Football stats API key | Football (NFL, NCAA) | Optional (ESPN fallback) |
| `SOCCER_API_KEY` | [API-Football](https://www.api-football.com/) key | Soccer (EPL, La Liga, etc.) | Optional |
| `ESPORTS_API_KEY` | [PandaScore](https://pandascore.co/) API key | Esports (LOL, CSGO, etc.) | Recommended for esports |

**Notes:**
- Basketball and Football use ESPN as a fallback (no key required)
- For best results with esports, PandaScore is recommended
- Some providers offer free tiers sufficient for testing

---

### Lines / Odds Providers

These APIs provide betting lines and odds from sportsbooks.

| Variable | Description | Required for Production |
|----------|-------------|------------------------|
| `ODDS_API_KEY` | [The Odds API](https://the-odds-api.com/) key | Recommended |
| `LINES_API_KEY` | Alternative lines provider key | Optional |

**Notes:**
- The Odds API offers a free tier with limited requests
- Without a lines provider, mock lines are generated based on projections
- For accurate edge detection, real lines are essential

---

### Optional Integrations

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI-enhanced reasoning | Optional |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | Optional |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Optional |

---

## Cloudflare Pages Configuration

### Setting Variables in Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to: **Pages** → Your Project → **Settings** → **Environment variables**
3. Click **Add variable**
4. Enter the variable name (e.g., `FIREBASE_PROJECT_ID`) and value
5. Choose environment: Production, Preview, or both
6. For sensitive values (API keys), enable **Encrypt**

### Example Cloudflare Bindings

```
# Production Environment Variables
USE_MOCK_DATA = false
FIREBASE_PROJECT_ID = your-firebase-project-id
FIREBASE_API_KEY = AIza...your-api-key
BASKETBALL_API_KEY = your-balldontlie-key
ODDS_API_KEY = your-odds-api-key

# Preview Environment (for testing)
USE_MOCK_DATA = true
FIREBASE_PROJECT_ID = your-firebase-project-id
```

### Important Notes for Cloudflare

- **Do NOT use `process.env`** in Cloudflare Workers - use `env.VARIABLE_NAME`
- Variables are accessed via the `env` parameter in fetch handlers
- Encrypt all API keys and secrets
- You can have different values for Production vs Preview environments

---

## Local Development

### Using `.env.local`

Create `projection-engine/.env.local` with your configuration:

```env
# Mode (start with mock mode enabled)
USE_MOCK_DATA=true

# Firebase (add when ready)
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_API_KEY=your-api-key-here

# Sports APIs (add as you sign up)
BASKETBALL_API_KEY=
FOOTBALL_API_KEY=
SOCCER_API_KEY=
ESPORTS_API_KEY=

# Lines API (add when ready)
ODDS_API_KEY=
```

### Running Locally with Wrangler

```bash
# Install wrangler if not installed
npm install -g wrangler

# Run Pages Function locally
wrangler pages dev ./projection-engine/frontend --binding USE_MOCK_DATA=true

# Or with env file
wrangler pages dev ./projection-engine/frontend --env-file ./projection-engine/.env.local
```

### Running with Node.js (Express server)

```bash
cd projection-engine
npm install
npm run dev
```

---

## Troubleshooting

### "Missing API Key" Errors

If you see errors like "Missing LINES_API_KEY":
1. Check if mock mode is enabled (`USE_MOCK_DATA=true`)
2. Verify the key is set in Cloudflare Variables or `.env.local`
3. Ensure the variable name matches exactly (case-sensitive)

### Firebase Connection Issues

1. Verify `FIREBASE_PROJECT_ID` is correct
2. Check Firebase Console for the correct API key
3. Ensure Firestore is enabled in your Firebase project
4. Review Firestore security rules

### Mock Data Showing Instead of Live Data

1. Set `USE_MOCK_DATA=false`
2. Verify all required provider keys are set
3. Restart the dev server or redeploy

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use `.env.local`** for local development (it's in `.gitignore`)
3. **Encrypt variables** in Cloudflare Pages settings
4. **Use different keys** for development and production
5. **Rotate keys** periodically and if compromised

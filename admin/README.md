# Admin Tools - THE Slipsmith

This directory contains self-contained admin tools for rendering morning slips and grading picks with live sports data.

## 📁 Files

### 1. `the-slipsmith.html`
The main admin tool that combines slip rendering, results grading, and recap generation into one unified interface.

**Features:**
- **Generate Tab**: Render beautiful printable slip sheets from JSON
- **Results Tab**: Fetch live stats and grade picks automatically (HIT/MISS/PUSH/VOID)
- **Recap Tab**: Generate scored recap sheets with summary statistics
- Print-friendly CSS for professional output
- In-memory caching for API responses
- localStorage persistence for last-used JSON
- Export/download functionality for JSON data

**How to Use:**
1. Open `the-slipsmith.html` in your browser
2. Click a "Load Sample" button or paste your slip JSON
3. Use the tabs to:
   - **Generate**: Render slip sheets for printing/sharing
   - **Results**: Grade picks with live stats from sports APIs
   - **Recap**: Create summary sheets showing outcomes
4. Export graded JSON or print results

### 2. `results-bot.html`
Standalone grading tool that focuses on automated pick verification with live stats.

**Features:**
- Automated pick grading with real-time data
- Summary statistics (hits, misses, pushes, voids)
- Export graded results as JSON
- Same API integrations as THE Slipsmith

**How to Use:**
1. Open `results-bot.html` in your browser
2. Paste your slip JSON or load sample data
3. Click "Grade Picks" to fetch stats and grade
4. Download graded results for archiving

## 🏀 Sports API Integrations

All tools use **free, public APIs** with no authentication required:

### NBA - balldontlie.io
- **Endpoint**: `https://www.balldontlie.io/api/v1`
- **Data**: Games, players, stats (points, rebounds, assists, fg3m, etc.)
- **Status**: Free tier available, rate-limited
- **CORS**: Generally accessible from browser

### NHL - statsapi.web.nhl.com
- **Endpoint**: `https://statsapi.web.nhl.com/api/v1`
- **Data**: Schedule, boxscores, player stats (goals, assists, shots, saves)
- **Status**: Public API, no key required
- **CORS**: May have restrictions on some endpoints

### NFL - ESPN Public API
- **Endpoint**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl`
- **Data**: Scoreboard, summaries, boxscore (rushing/passing/receiving yards, team totals)
- **Implementation**: Map VIS@HOME game_id to ESPN event IDs via scoreboard endpoint
- **Status**: Public endpoints, no key required
- **CORS**: May encounter restrictions; implement fallback logic

### Soccer - ESPN Soccer Endpoints
- **Endpoint**: `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}`
- **Data**: Match scoreboard, statistics (goals, assists for supported leagues)
- **Leagues**: EPL, La Liga, Bundesliga, Serie A, Champions League, etc.
- **Implementation**: Map game identifiers to ESPN event IDs
- **Status**: Public endpoints, no key required
- **CORS**: May encounter restrictions

## 📊 Slip JSON Schema

```json
{
  "slip_id": "NBA_2024_01_15",
  "date": "2024-01-15",
  "sport": "NBA",
  "league": "Optional league identifier (for Soccer)",
  "events": [
    {
      "event_id": "unique_event_id",
      "game_id": "VIS@HOME (e.g., LAL@GSW)",
      "time": "10:00 PM ET",
      "player": "Player Name",
      "team": "Team abbreviation",
      "market": "points|rebounds|assists|goals|passing_yards|etc",
      "line": 27.5,
      "direction": "over|under"
    }
  ]
}
```

### Supported Markets by Sport

**NBA:**
- `points`, `rebounds`, `assists`, `fg3m` (3-pointers made)
- `steals`, `blocks`, `turnovers`

**NHL:**
- `goals`, `assists`, `shots`, `saves` (goalies)
- `hits`, `blocks`, `takeaways`

**NFL:**
- `passing_yards`, `rushing_yards`, `receiving_yards`
- `passing_tds`, `rushing_tds`, `receptions`
- Team totals: `total_points`, `total_yards`

**Soccer:**
- `goals`, `assists`, `shots`, `shots_on_target`
- Team markets: `team_goals`, `corners`, `cards`

## 🎨 Design & Theme

Both tools use the Slipsmith dark theme:
- **Primary**: Dark green/teal (#0a0e0f, #131a1d)
- **Accent**: Money green (#00ff88) and mint highlights (#66ffcc)
- **Status badges**: Color-coded (green=HIT, red=MISS, yellow=PUSH, gray=VOID, blue=PENDING)
- **Print-friendly**: Special CSS for clean printed output

## ⚠️ Known Limitations & CORS

### CORS (Cross-Origin Resource Sharing)
Some APIs may block browser requests due to CORS policies. Workarounds:

1. **Browser Extensions**: Use CORS Unblock or similar extensions for development
2. **Proxy Server**: Route requests through a CORS proxy (e.g., `https://cors-anywhere.herokuapp.com/`)
3. **Server-Side Alternative**: Deploy a lightweight backend to fetch data
4. **Fallback Logic**: Tools mark picks as PENDING with clear error messages when APIs fail

### Game Completion
- Stats are only available after games complete
- Live/in-progress games may return incomplete data
- Tools will mark picks as PENDING if data is unavailable

### API Rate Limits
- **balldontlie.io**: Limited requests per minute on free tier
- **NHL/ESPN**: Generally generous, but may throttle rapid requests
- **Solution**: In-memory caching reduces duplicate calls

### Player Name Matching
- APIs may use different player name formats
- Implement fuzzy matching or team roster lookups for accuracy
- Tools provide clear error messages for unmatched players

## 🚀 Getting Started

### Basic Usage (No Server Required)
1. Simply open the HTML files directly in your browser
2. All functionality is client-side JavaScript
3. No build steps or dependencies needed

### Optional: Serve with HTTP Server
For testing CORS or localStorage features:

```bash
# Python
python -m http.server 8000

# Node.js
npx http-server

# Then open http://localhost:8000/admin/the-slipsmith.html
```

### Adding to Site Navigation
If your site has an admin index (e.g., `admin.html`), add a link:

```html
<a href="admin/the-slipsmith.html">THE Slipsmith</a>
<a href="admin/results-bot.html">Results Bot</a>
```

Or access directly via:
- `/admin/the-slipsmith.html`
- `/admin/results-bot.html`

## 🔧 Implementation Notes

### Client-Side Caching
Both tools implement in-memory Map-based caching to minimize API calls:
```javascript
const apiCache = {
    nba: new Map(),
    nhl: new Map(),
    nfl: new Map(),
    soccer: new Map()
};
```

### localStorage Persistence
THE Slipsmith saves the last-used JSON to browser storage:
```javascript
localStorage.setItem('slipsmith_last_json', json);
```

### Grading Logic
Picks are graded based on actual value vs. line:
- **HIT**: (Over and actual > line) OR (Under and actual < line)
- **MISS**: (Over and actual < line) OR (Under and actual > line)
- **PUSH**: actual === line (exact hit)
- **VOID**: Missing data, invalid event, or API error
- **PENDING**: Game not complete or API unavailable

### Error Handling
All API calls include try-catch blocks with descriptive error messages:
- "Player not found in boxscore"
- "Game data unavailable (not yet completed)"
- "CORS error: API blocked browser request"
- "API rate limit exceeded"

## 📱 Mobile Friendly

Both tools are responsive and work on mobile devices:
- Touch-friendly buttons and controls
- Flexible grid layouts
- Readable font sizes
- Printable output optimized for mobile browsers

## 🛠️ Customization

### Extending Sports Support
To add a new sport:

1. Add API handler function:
```javascript
async function fetchNEWSPORTStats(event, date) {
    // Implement API calls
    return { value: actualValue, reason: 'Description' };
}
```

2. Add case in grading logic:
```javascript
case 'NEWSPORT':
    stats = await fetchNEWSPORTStats(event, date);
    break;
```

3. Add sample JSON in samples object

### Styling Changes
All styles are inline in `<style>` tags. Modify CSS variables:
```css
:root {
    --accent-green: #00ff88;  /* Change primary color */
    --bg-primary: #0a0e0f;     /* Change background */
}
```

## 📄 License

Part of the Slipsmith platform. For internal use.

## 🐛 Troubleshooting

**Problem**: API requests failing with CORS errors
- **Solution**: Use a CORS proxy or browser extension for development

**Problem**: Player stats not found
- **Solution**: Verify player name spelling matches API format; implement fuzzy matching

**Problem**: localStorage not persisting
- **Solution**: Check browser privacy settings; some modes block localStorage

**Problem**: Print layout broken
- **Solution**: Use print preview to check; adjust `@media print` CSS rules

**Problem**: Slow API responses
- **Solution**: Implement request batching or increase cache usage

## 📞 Support

For issues or questions about these tools, contact the Slipsmith admin team.

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0

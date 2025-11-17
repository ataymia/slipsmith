# Admin Tools - THE Slipsmith

This directory contains self-contained admin tools for rendering morning slips and grading picks.

**⚠️ IMPORTANT: This is a front-end only tool. No API keys or backend setup required!**

## 📁 Files

### 1. `the-slipsmith.html`
The main admin tool that combines slip rendering, results grading, and recap generation into one unified interface.

**Features:**
- **Generate Tab**: Render beautiful printable slip sheets from JSON with gradients and rounded corners
- **Results Tab**: Grade picks with mock data (real API integration coming soon)
- **Recap Tab**: Generate scored recap sheets with summary statistics
- Print-friendly CSS for professional output
- localStorage persistence for last-used JSON
- Export/download functionality for JSON data
- **100% Front-End**: No server, no API keys, no setup required!

**How to Use:**
1. Simply open `the-slipsmith.html` in your browser (no installation needed!)
2. Click a "Load Sample" button or paste your slip JSON
3. Use the tabs to:
   - **Generate**: Render slip sheets for printing/sharing
   - **Results**: Grade picks with mock data (or manually enter results)
   - **Recap**: Create summary sheets showing outcomes
4. Export graded JSON or print results

**No API keys needed!** The tool works entirely in your browser.

### 2. `results-bot.html` _(Coming Soon)_
Standalone grading tool will focus on automated pick verification.

**Planned Features:**
- Automated pick grading with real-time data
- Summary statistics (hits, misses, pushes, voids)
- Export graded results as JSON

For now, use THE Slipsmith tool above which includes all functionality.

## 🏀 Sports Data (Future Enhancement)

**Current Status**: The tool uses **mock data** for demonstration purposes. You can manually enter actual results in your JSON.

**Future Enhancement**: We plan to integrate free, public sports APIs for automatic data fetching. These will require **NO API KEYS** as they're public endpoints:

### Planned APIs (No Keys Required)

#### NBA - balldontlie.io
- **Endpoint**: `https://www.balldontlie.io/api/v1`
- **Data**: Games, players, stats (points, rebounds, assists, fg3m, etc.)
- **Status**: Public API, no authentication needed

#### NHL - statsapi.web.nhl.com
- **Endpoint**: `https://statsapi.web.nhl.com/api/v1`
- **Data**: Schedule, boxscores, player stats (goals, assists, shots, saves)
- **Status**: Public API, no authentication needed

#### NFL - ESPN Public API
- **Endpoint**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl`
- **Data**: Scoreboard, summaries, boxscore (rushing/passing/receiving yards, team totals)
- **Status**: Public endpoint, no authentication needed

#### Soccer - ESPN Soccer Endpoints
- **Endpoint**: `https://site.api.espn.com/apis/site/v2/sports/soccer/{league}`
- **Data**: Match scoreboard, statistics (goals, assists for supported leagues)
- **Leagues**: EPL, La Liga, Bundesliga, Serie A, Champions League, etc.
- **Status**: Public endpoint, no authentication needed

**Note**: These APIs are for future development. Current implementation uses mock data, so you can use the tool immediately without any setup!

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

## 💡 Current Functionality

**What Works Now (No Setup Required):**
- ✅ Beautiful slip sheet generation with gradients and rounded corners
- ✅ Load sample data for NBA, NHL, NFL, and Soccer
- ✅ Manual results entry via JSON
- ✅ Recap sheet generation with statistics
- ✅ Print-friendly output
- ✅ Image export functionality
- ✅ localStorage for saving your work

**What's Coming (Future API Integration):**
- 🔄 Automatic live stats fetching (will use public APIs, no keys needed)
- 🔄 Real-time game data integration
- 🔄 Automatic pick grading

For now, simply enter actual results manually in your JSON or use the mock data for testing!

## 🚀 Getting Started

### Quick Start (Easiest!)
1. Simply double-click `the-slipsmith.html` to open it in your browser
2. Click "Load NBA Sample" (or any sample) to see it in action
3. Click "🎨 Render Slip" to generate your slip sheet
4. That's it! No installation, no API keys, no setup!

### Optional: Serve with HTTP Server
If you want to test on localhost (for localStorage features):

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

## 🔧 How It Works

### localStorage Persistence
THE Slipsmith saves the last-used JSON to your browser:
```javascript
localStorage.setItem('slipsmith_last_json', json);
```

### Grading Logic
Picks are graded based on actual value vs. line:
- **HIT**: (Over and actual > line) OR (Under and actual < line)
- **MISS**: (Over and actual < line) OR (Under and actual > line)
- **PUSH**: actual === line (exact hit)
- **VOID**: Missing data or invalid event

### Current Implementation
- Uses mock/sample data for demonstration
- You can manually add `result`, `actual_value`, and `reason` fields to your JSON
- All processing happens in your browser (no data sent anywhere)

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

**Problem**: Tool won't open or displays incorrectly
- **Solution**: Use a modern browser (Chrome, Firefox, Safari, Edge). Internet Explorer is not supported.

**Problem**: localStorage not persisting
- **Solution**: Check browser privacy settings; some modes block localStorage

**Problem**: Print layout broken
- **Solution**: Use print preview to check; modern browsers work best

**Problem**: Can't see my saved work
- **Solution**: Click "Load from Storage" button to restore your last JSON

**Problem**: Want live API data instead of mock data
- **Solution**: This feature is coming soon! For now, manually update your JSON with actual results.

## 📞 Support

For issues or questions about these tools, contact the Slipsmith admin team.

---

**Last Updated**: 2025-01-17
**Version**: 2.0.0 - Now with beautiful gradients and rounded corners!

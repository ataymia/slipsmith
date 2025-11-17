# Admin Directory

This directory contains admin tools and pages for the $lip$mith platform.

## Results Bot

The **Results Bot** (`results-bot.html`) is a standalone tool for automatically grading sports betting events using free public APIs.

### Features

- **NBA Grading**: Uses the balldontlie.io API (free, no API key required)
  - Player stats: points, rebounds, assists, 3-pointers, steals, blocks
  - Team totals and game totals
  
- **NHL Grading**: Uses the NHL Stats API (free, no API key required)
  - Skater stats: goals, assists, shots, points
  - Goalie stats: saves, shots against
  - Team totals and game totals

- **Client-side caching**: Reduces API calls during a grading session
- **Batch grading**: Grade multiple events at once using JSON input
- **Clear feedback**: Each event includes actual value and grading reason

### Usage

1. **Access the tool**:
   - Navigate to `/admin/results-bot.html` in your browser
   - Or click the "Results Bot" tab from the main admin dashboard

2. **Configure your grading run**:
   - Select the sport (NBA or NHL)
   - Choose the date of the games
   - Add events either:
     - By pasting a JSON array in the textarea, OR
     - By using the event builder to add rows manually

3. **Event format**:
   ```json
   {
     "game_id": "LAL@GSW",
     "market": "pts",
     "player": "LeBron James",
     "line": 25.5,
     "direction": "over"
   }
   ```

4. **Game ID format**:
   - NBA: `VISITOR@HOME` (e.g., `LAL@GSW`)
   - NHL: `AWAY@HOME` (e.g., `TOR@BOS`)
   - Use standard team abbreviations

5. **Supported markets**:
   - **NBA**: `pts`, `reb`, `ast`, `fg3m`, `stl`, `blk`, `team_total`, `total_points`
   - **NHL**: `goals`, `assists`, `points`, `shots`, `saves`, `shots_against`, `team_total`, `total_goals`

6. **Click "Grade Events"** to start the grading process

### Adding to Admin Navigation

If you haven't already, add a link to the Results Bot in your admin dashboard:

1. Open `admin.html`
2. Find the `.admin-tabs` section
3. Add a new tab button:
   ```html
   <button class="tab-btn" data-tab="results-bot">Results Bot</button>
   ```
4. Or add a direct link in the admin content area:
   ```html
   <a href="admin/results-bot.html" class="btn btn-primary">🤖 Results Bot</a>
   ```

### Technical Notes

- **No API keys required**: Both APIs are completely free and public
- **CORS-friendly**: Both APIs support cross-origin requests
- **Client-side only**: All processing happens in the browser
- **Self-contained**: The HTML file includes all CSS and JavaScript inline
- **Caching**: Results are cached during each session to minimize API calls

### Troubleshooting

- **Game not found**: Verify the date format (YYYY-MM-DD) and team abbreviations
- **Player not found**: Try using full name or last name only; check spelling
- **CORS errors**: Ensure you're accessing via HTTP/HTTPS, not file://
- **Stats not available**: Game must be completed (status: Final)

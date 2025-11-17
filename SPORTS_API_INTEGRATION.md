# Sports API Integration Guide

This document provides options for integrating real-time sports news, injury reports, and updates into the SlipSmith Live Sports Feed.

## Recommended Free APIs

### 1. ESPN "Hidden" API ⭐ RECOMMENDED
- **Best for**: Real-time injury reports, game summaries, player stats
- **Sports**: NBA, NFL, MLB, NHL, and more
- **Cost**: Free (no API key required)
- **Rate Limits**: No official limits (be respectful)
- **Documentation**: Community-documented endpoints

#### Example Endpoints:
```javascript
// NBA Injuries
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries

// NFL Injuries  
https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries

// Game Summary
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gameId}

// Scoreboard (Today's games)
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
```

#### Sample Integration Code:
```javascript
async function fetchESPNInjuries(sport = 'basketball', league = 'nba') {
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/injuries`
    );
    const data = await response.json();
    
    // Parse injuries and add to Firestore feed collection
    const injuries = data.injuries?.map(item => ({
      sport: league.toUpperCase(),
      type: 'injury',
      headline: `${item.athlete?.displayName || 'Player'} - ${item.status || 'Injury Update'}`,
      details: item.comment || item.details || '',
      player: item.athlete?.displayName || '',
      team: item.team?.displayName || '',
      publishedAt: new Date(item.date || Date.now()),
      url: item.athlete?.links?.[0]?.href || ''
    })) || [];
    
    return injuries;
  } catch (error) {
    console.error('Error fetching ESPN injuries:', error);
    return [];
  }
}
```

### 2. BALLDONTLIE
- **Best for**: Lightning-fast real-time stats and injury data
- **Sports**: NBA, NFL, MLB, NHL, WNBA, College, EPL
- **Cost**: Free tier available
- **Rate Limits**: Generous (updates every second during games)
- **Documentation**: https://www.balldontlie.io/

#### Example Usage:
```javascript
async function fetchBallDontLieData() {
  const response = await fetch('https://www.balldontlie.io/api/v1/players?search=lebron');
  const data = await response.json();
  return data;
}
```

### 3. TheSportsDB
- **Best for**: Complete sports data with community support
- **Sports**: 50+ sports including NFL, NBA, MLB, NHL
- **Cost**: Free tier (Patreon for extended access)
- **Rate Limits**: Fair use policy
- **Documentation**: https://www.thesportsdb.com/api.php

#### Example Endpoints:
```javascript
// Get team info
https://www.thesportsdb.com/api/v1/json/{API_KEY}/searchteams.php?t=Arsenal

// Get player info
https://www.thesportsdb.com/api/v1/json/{API_KEY}/searchplayers.php?p=Danny_Welbeck

// Get next 5 events by team
https://www.thesportsdb.com/api/v1/json/{API_KEY}/eventsnext.php?id=133602
```

### 4. MySportsFeeds
- **Best for**: Comprehensive stats with play-by-play
- **Sports**: NFL, MLB, NBA, NHL
- **Cost**: Free for personal/non-commercial use
- **Formats**: JSON, XML, CSV
- **Documentation**: https://www.mysportsfeeds.com/data-feeds

## Firebase Cloud Function Integration Example

Create a scheduled function to fetch and store sports news:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// Run every 15 minutes
exports.fetchSportsNews = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const leagues = ['nba', 'nfl', 'nhl', 'mlb'];
    const sportMap = {
      nba: 'basketball',
      nfl: 'football', 
      nhl: 'hockey',
      mlb: 'baseball'
    };
    
    for (const league of leagues) {
      try {
        const sport = sportMap[league];
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/injuries`
        );
        const data = await response.json();
        
        // Process and store injuries
        const batch = db.batch();
        
        data.injuries?.forEach((item, index) => {
          const docRef = db.collection('feed').doc(`${league}-injury-${Date.now()}-${index}`);
          batch.set(docRef, {
            sport: league.toUpperCase(),
            type: 'injury',
            headline: `${item.athlete?.displayName || 'Player'} - ${item.status || 'Injury Update'}`,
            details: item.comment || item.details || '',
            player: item.athlete?.displayName || '',
            team: item.team?.displayName || '',
            publishedAt: admin.firestore.Timestamp.fromDate(new Date(item.date || Date.now())),
            url: item.athlete?.links?.[0]?.href || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        
        await batch.commit();
        console.log(`Successfully updated ${league.toUpperCase()} injuries`);
      } catch (error) {
        console.error(`Error fetching ${league} injuries:`, error);
      }
    }
    
    return null;
  });
```

## Manual Testing Without Cloud Functions

For immediate testing without setting up Cloud Functions:

1. Use the admin portal to manually add test feed items
2. Use the browser console to add items directly:

```javascript
// Add a test injury report
await db.collection('feed').add({
  sport: 'NBA',
  type: 'injury',
  headline: 'LeBron James - Day to Day',
  details: 'Left ankle soreness, questionable for next game',
  player: 'LeBron James',
  team: 'Los Angeles Lakers',
  publishedAt: firebase.firestore.Timestamp.now(),
  url: 'https://www.espn.com/nba/',
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
```

## Firestore Feed Collection Schema

```javascript
{
  sport: 'NBA' | 'NFL' | 'NHL' | 'MLB' | 'UCL',
  type: 'injury' | 'suspension' | 'news' | 'line_movement' | 'depth_chart',
  headline: string,
  details: string (optional),
  player: string (optional),
  team: string (optional),
  publishedAt: timestamp,
  url: string (optional),
  createdAt: timestamp
}
```

## Next Steps

1. Choose your preferred API (ESPN recommended for starting)
2. Set up Firebase Cloud Functions with the scheduled function above
3. Deploy the function: `firebase deploy --only functions`
4. Monitor the feed collection in Firestore console
5. The UI will automatically display new items as they arrive

## Rate Limiting Best Practices

- Cache responses for at least 5-10 minutes
- Use Cloud Functions scheduled triggers instead of client-side polling
- Implement exponential backoff for failed requests
- Monitor API usage if using paid tiers

## Alternative: RSS Feed Parsing

If APIs are unavailable, you can also parse RSS feeds from:
- ESPN: https://www.espn.com/espn/rss/news
- CBS Sports: https://www.cbssports.com/rss/
- Yahoo Sports: https://sports.yahoo.com/rss/

Use a Cloud Function with an RSS parser library to convert feeds to your schema.

## Support

For questions or issues with sports API integration:
- ESPN API: Community forums and GitHub discussions
- BALLDONTLIE: https://www.balldontlie.io/
- TheSportsDB: Discord server and community forums
- MySportsFeeds: Documentation and support portal

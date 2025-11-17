# Firebase Cloud Functions - Example Implementation

This directory contains example Cloud Functions for the SlipSmith sports feed integration.

## Setup Instructions

### 1. Initialize Firebase Functions (if not already done)

```bash
# Navigate to your project root
cd /path/to/slipsmith

# Initialize Firebase Functions
firebase init functions

# Choose:
# - JavaScript (or TypeScript if preferred)
# - Install dependencies
```

### 2. Copy the Sports Feed Function

```bash
# Copy the example function to your functions directory
cp functions-example/sportsFeed.js functions/

# Or merge the code into your existing functions/index.js
```

### 3. Install Required Dependencies

```bash
cd functions
npm install node-fetch
```

### 4. Add to functions/index.js

```javascript
const sportsFeed = require('./sportsFeed');

// Export the functions
exports.fetchSportsNews = sportsFeed.fetchSportsNews;
exports.triggerSportsFetch = sportsFeed.triggerSportsFetch;
exports.fetchSportsRSS = sportsFeed.fetchSportsRSS;
```

### 5. Deploy to Firebase

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:fetchSportsNews
```

## Available Functions

### 1. `fetchSportsNews` (Scheduled)
- **Trigger**: Runs every 15 minutes
- **Purpose**: Fetches injury reports from ESPN API for NBA, NFL, NHL, MLB
- **Output**: Stores feed items in Firestore `feed` collection

### 2. `triggerSportsFetch` (HTTP Callable)
- **Trigger**: Manually called by admin users
- **Purpose**: Immediately fetch and update sports news
- **Auth**: Requires admin role

Usage from client:
```javascript
const triggerFetch = firebase.functions().httpsCallable('triggerSportsFetch');
try {
  const result = await triggerFetch();
  console.log(result.data.message);
} catch (error) {
  console.error('Error:', error);
}
```

### 3. `fetchSportsRSS` (Scheduled - Optional)
- **Trigger**: Runs every 30 minutes
- **Purpose**: Backup feed source using RSS parsing
- **Status**: Placeholder - requires implementation

## Testing Functions Locally

```bash
# Install Firebase emulators
firebase init emulators

# Start emulator suite
firebase emulators:start

# Test scheduled function manually
firebase functions:shell
> fetchSportsNews()
```

## Monitoring and Logs

```bash
# View function logs
firebase functions:log

# View logs for specific function
firebase functions:log --only fetchSportsNews

# Monitor in real-time
firebase functions:log --tail
```

## Cost Considerations

### Free Tier Limits (Spark Plan)
- 125K invocations/month
- 40K GB-seconds/month
- 40K CPU-seconds/month

**Estimated usage for this setup:**
- fetchSportsNews: 4 times/hour × 24 hours × 30 days = 2,880 invocations/month
- Well within free tier limits

### Blaze Plan (Pay as you go)
If you exceed free tier:
- $0.40 per million invocations
- $0.0000025 per GB-second
- $0.0000100 per CPU-second

## Customization Options

### Adjust Fetch Frequency

Edit the schedule in `sportsFeed.js`:
```javascript
// Every 15 minutes (default)
.schedule('every 15 minutes')

// Every hour
.schedule('every 1 hours')

// Every 30 minutes
.schedule('every 30 minutes')

// Specific time (daily at 6 AM)
.schedule('0 6 * * *')
```

### Add More Sports

Add more leagues to the array:
```javascript
const leagues = [
  { league: 'nba', sport: 'basketball' },
  { league: 'nfl', sport: 'football' },
  { league: 'nhl', sport: 'hockey' },
  { league: 'mlb', sport: 'baseball' },
  { league: 'wnba', sport: 'basketball' },
  { league: 'ncaab', sport: 'basketball' } // College Basketball
];
```

### Filter by Team

Add team filtering:
```javascript
const myTeams = ['Lakers', 'Patriots', 'Yankees'];
const filteredInjuries = data.injuries.filter(item => 
  myTeams.includes(item.team?.displayName)
);
```

## Firestore Security Rules

Add these rules to protect the feed collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /feed/{feedId} {
      // Anyone authenticated can read
      allow read: if request.auth != null;
      
      // Only admins and server can write
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Troubleshooting

### Function times out
- Increase timeout in firebase.json:
```json
{
  "functions": {
    "timeoutSeconds": 300
  }
}
```

### API rate limiting
- Add delays between requests:
```javascript
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
```

### Memory issues
- Increase allocated memory:
```javascript
exports.fetchSportsNews = functions
  .runWith({ memory: '512MB' })
  .pubsub.schedule('every 15 minutes')
  .onRun(async (context) => {
    // ...
  });
```

## Alternative Free APIs

If ESPN API is rate-limited or unavailable, see `SPORTS_API_INTEGRATION.md` for alternatives:
- BALLDONTLIE
- TheSportsDB  
- MySportsFeeds
- API-SPORTS

## Support

For Firebase Functions help:
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Community](https://firebase.google.com/community)
- [Stack Overflow - firebase-functions tag](https://stackoverflow.com/questions/tagged/firebase-functions)

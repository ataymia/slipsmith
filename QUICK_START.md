# Quick Start Guide - SlipSmith New Features

## 🚀 What's New

This update adds three major features to SlipSmith:
1. **Usernames everywhere** - Display usernames throughout the app
2. **Friends list with online status** - Social features in the inbox
3. **Live Sports Feed** - Real-time sports news and injury reports

## ✅ Ready to Use Right Now

Everything works out of the box! No additional setup needed to use:

### 1. Test the Sports Feed (5 minutes)

**As Admin:**
1. Log into admin panel
2. Click "Sports Feed" tab
3. Click "Load 10 Sample Items"
4. Go to Portal page
5. See the Live Sports Feed with filters!

**Try the filters:**
- Click NBA, NFL, NHL, MLB, or UCL
- See how items are color-coded by type
- Injuries are red, suspensions are yellow, news is blue

### 2. Test Friends & Online Status (5 minutes)

**Create test accounts:**
1. Create 2 test users (user1 and user2)
2. Set usernames for both in Account page

**Add friends:**
1. Log in as user1
2. Go to Inbox → Friends tab
3. Click "Add Friend"
4. Search for user2's username
5. Send friend request

**Accept request:**
1. Log in as user2
2. Go to Inbox → Friends tab
3. See pending request
4. Click "Accept"

**Check status:**
1. See online indicator (green dot if active < 5 min ago)
2. See "Last seen" timestamps
3. Try "Message" button to DM

### 3. Verify Usernames Display

**Check these locations:**
- Inbox conversation list
- Chat messages in Portal
- Admin slip requests
- New message "To:" field (search by username)

## 🔧 Optional: Automated Sports Feed

Want automatic sports news updates? Deploy the Cloud Function:

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project configured

### Quick Deploy (10 minutes)

```bash
# 1. Navigate to project
cd /path/to/slipsmith

# 2. Initialize functions (if not already done)
firebase init functions

# 3. Copy the function
cp functions-example/sportsFeed.js functions/

# 4. Install dependency
cd functions
npm install node-fetch

# 5. Add export to functions/index.js
# Add this line:
# exports.fetchSportsNews = require('./sportsFeed').fetchSportsNews;

# 6. Deploy
firebase deploy --only functions:fetchSportsNews
```

### What It Does
- Runs every 15 minutes automatically
- Fetches injuries from ESPN API for NBA, NFL, NHL, MLB
- Stores in `feed` collection in Firestore
- Cleans up items older than 7 days
- Completely free (well within Firebase free tier)

### Test It Works
After deployment:
1. Wait 15 minutes OR trigger manually from admin panel
2. Check Firestore console → `feed` collection
3. View new items on Portal page

## 🔒 Important: Security Rules

Add these to your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... existing rules ...
    
    // Feed collection
    match /feed/{feedId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Friendships
    match /friendships/{friendshipId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.users;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && 
        request.auth.uid in resource.data.users;
    }
    
    // Friend requests
    match /friendRequests/{requestId} {
      allow read: if request.auth != null && 
        (request.auth.uid == resource.data.fromUserId || 
         request.auth.uid == resource.data.toUserId);
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.fromUserId;
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.toUserId;
    }
  }
}
```

## 📊 Free Sports API Options

The ESPN API is free and requires no key! Example:

```bash
# Get NBA injuries
curl https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries

# Get NFL injuries  
curl https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries
```

See `SPORTS_API_INTEGRATION.md` for 5 more free API options!

## 🎨 Customization

### Change Update Frequency

Edit `functions/sportsFeed.js`:
```javascript
// Change from every 15 minutes to every hour
.schedule('every 1 hours')

// Or daily at 6 AM
.schedule('0 6 * * *')
```

### Add More Sports

In `functions/sportsFeed.js`, add to the leagues array:
```javascript
const leagues = [
  { league: 'nba', sport: 'basketball' },
  { league: 'nfl', sport: 'football' },
  { league: 'nhl', sport: 'hockey' },
  { league: 'mlb', sport: 'baseball' },
  { league: 'wnba', sport: 'basketball' }, // Add this
  { league: 'ncaab', sport: 'basketball' } // And this
];
```

### Customize Feed Display

Edit the sport filter buttons in `portal.html`:
```html
<button class="sport-filter-btn" data-sport="WNBA">WNBA</button>
<button class="sport-filter-btn" data-sport="NCAA">NCAA</button>
```

## 🐛 Troubleshooting

### Friends not showing online
- Check that user visited Portal or Inbox recently
- Verify `lastSeen` field exists in users collection
- Online = visited within last 5 minutes

### Feed items not showing
- Load sample data from admin panel first
- Check Firestore → `feed` collection has items
- Verify user is logged in
- Check browser console for errors

### Cloud Function not running
- Check Firebase Console → Functions tab
- View logs: `firebase functions:log`
- Verify deployment succeeded
- Check function has proper permissions

### ESPN API not working
- Check internet connection
- Try alternative APIs in documentation
- ESPN API is unofficial and may change

## 📚 Full Documentation

For complete details, see:
- `IMPLEMENTATION_SUMMARY.md` - Complete feature overview
- `SPORTS_API_INTEGRATION.md` - API integration guide
- `functions-example/README.md` - Cloud Functions setup
- `functions-example/addSampleFeedData.js` - Sample data scripts

## 🎉 You're All Set!

Everything is working and ready to use. The automated Cloud Function is optional - you can manage the feed manually from the admin panel if you prefer.

Enjoy your new features! 🚀

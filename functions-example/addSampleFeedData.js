/**
 * Helper script to add sample sports feed data
 * 
 * USAGE:
 * 1. Open Firebase Console > Firestore
 * 2. Open browser console
 * 3. Copy and paste this code
 * 4. Call: await addSampleFeedData()
 * 
 * OR from your app's admin panel, add a button that calls this function
 */

async function addSampleFeedData() {
  if (!window.db) {
    console.error('Firestore not initialized. Make sure firebase.js and app.js are loaded.');
    return;
  }
  
  const sampleData = [
    {
      sport: 'NBA',
      type: 'injury',
      headline: 'LeBron James - Questionable',
      details: 'Left ankle soreness. Day-to-day, questionable for next game against Warriors.',
      player: 'LeBron James',
      team: 'Los Angeles Lakers',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      url: 'https://www.espn.com/nba/player/_/id/1966/lebron-james',
      source: 'Manual Sample'
    },
    {
      sport: 'NFL',
      type: 'injury',
      headline: 'Patrick Mahomes - Out',
      details: 'High ankle sprain. Ruled out for Sunday\'s game. Expected to miss 2-3 weeks.',
      player: 'Patrick Mahomes',
      team: 'Kansas City Chiefs',
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      url: 'https://www.espn.com/nfl/',
      source: 'Manual Sample'
    },
    {
      sport: 'NBA',
      type: 'suspension',
      headline: 'Draymond Green - Suspended',
      details: 'Suspended 5 games for flagrant foul. Will miss games against Nuggets, Suns, and Clippers.',
      player: 'Draymond Green',
      team: 'Golden State Warriors',
      publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      url: 'https://www.espn.com/nba/',
      source: 'Manual Sample'
    },
    {
      sport: 'MLB',
      type: 'news',
      headline: 'Yankees Sign Star Pitcher',
      details: 'New York Yankees sign ace pitcher to 5-year, $150M deal. Expected to anchor rotation.',
      team: 'New York Yankees',
      publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      url: 'https://www.espn.com/mlb/',
      source: 'Manual Sample'
    },
    {
      sport: 'NHL',
      type: 'injury',
      headline: 'Connor McDavid - Day to Day',
      details: 'Upper body injury. Listed as day-to-day, will be re-evaluated before next game.',
      player: 'Connor McDavid',
      team: 'Edmonton Oilers',
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      url: 'https://www.espn.com/nhl/',
      source: 'Manual Sample'
    },
    {
      sport: 'NBA',
      type: 'news',
      headline: 'Lakers vs Warriors - Line Movement',
      details: 'Spread moved from Lakers -3.5 to -5.0 following injury report. Over/Under adjusted to 225.5.',
      team: 'Los Angeles Lakers',
      publishedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      url: 'https://www.espn.com/nba/',
      source: 'Manual Sample'
    },
    {
      sport: 'NFL',
      type: 'news',
      headline: 'Bills Release Depth Chart Update',
      details: 'Starting lineup changes announced. Rookie WR moves to WR2 position, veteran slides to slot.',
      team: 'Buffalo Bills',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      url: 'https://www.espn.com/nfl/',
      source: 'Manual Sample'
    },
    {
      sport: 'NBA',
      type: 'injury',
      headline: 'Stephen Curry - Probable',
      details: 'Right shoulder soreness improving. Upgraded to probable for tonight\'s game.',
      player: 'Stephen Curry',
      team: 'Golden State Warriors',
      publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      url: 'https://www.espn.com/nba/',
      source: 'Manual Sample'
    },
    {
      sport: 'MLB',
      type: 'injury',
      headline: 'Mike Trout - Season Ending Surgery',
      details: 'Undergoes surgery on torn meniscus. Expected to miss remainder of season.',
      player: 'Mike Trout',
      team: 'Los Angeles Angels',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      url: 'https://www.espn.com/mlb/',
      source: 'Manual Sample'
    },
    {
      sport: 'UCL',
      type: 'news',
      headline: 'Manchester United vs Barcelona - Champions League Preview',
      details: 'Key matchup in knockout rounds. Both teams at full strength. Line: Man U +0.5.',
      team: 'Manchester United',
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      url: 'https://www.espn.com/soccer/uefa-champions-league/',
      source: 'Manual Sample'
    }
  ];
  
  try {
    const batch = window.db.batch();
    
    for (const item of sampleData) {
      const docRef = window.db.collection('feed').doc();
      batch.set(docRef, {
        ...item,
        publishedAt: firebase.firestore.Timestamp.fromDate(item.publishedAt),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();
    console.log(`✅ Successfully added ${sampleData.length} sample feed items!`);
    console.log('View them in the Live Sports Feed on the portal page.');
    return { success: true, count: sampleData.length };
  } catch (error) {
    console.error('❌ Error adding sample data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear all sample feed data
 */
async function clearSampleFeedData() {
  if (!window.db) {
    console.error('Firestore not initialized.');
    return;
  }
  
  if (!confirm('Are you sure you want to delete all sample feed data?')) {
    return;
  }
  
  try {
    const snapshot = await window.db.collection('feed')
      .where('source', '==', 'Manual Sample')
      .get();
    
    const batch = window.db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.size} sample feed items.`);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('❌ Error clearing sample data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add a single custom feed item
 */
async function addCustomFeedItem(item) {
  if (!window.db) {
    console.error('Firestore not initialized.');
    return;
  }
  
  const defaults = {
    sport: 'NBA',
    type: 'news',
    headline: 'Custom headline',
    details: '',
    publishedAt: new Date(),
    source: 'Manual Custom'
  };
  
  const feedItem = { ...defaults, ...item };
  
  try {
    await window.db.collection('feed').add({
      ...feedItem,
      publishedAt: firebase.firestore.Timestamp.fromDate(feedItem.publishedAt),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Custom feed item added successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error adding custom item:', error);
    return { success: false, error: error.message };
  }
}

// Export functions for use
if (typeof window !== 'undefined') {
  window.addSampleFeedData = addSampleFeedData;
  window.clearSampleFeedData = clearSampleFeedData;
  window.addCustomFeedItem = addCustomFeedItem;
  
  console.log('✨ Feed data helpers loaded!');
  console.log('Available functions:');
  console.log('  - addSampleFeedData()');
  console.log('  - clearSampleFeedData()');
  console.log('  - addCustomFeedItem({ sport, type, headline, details, ... })');
}

// Example usage:
/*
// Add all sample data
await addSampleFeedData();

// Add custom item
await addCustomFeedItem({
  sport: 'NFL',
  type: 'injury',
  headline: 'Tom Brady - Questionable',
  details: 'Thumb injury, game-time decision',
  player: 'Tom Brady',
  team: 'Tampa Bay Buccaneers'
});

// Clear all sample data
await clearSampleFeedData();
*/

/**
 * Firebase Cloud Function for fetching and storing sports news
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to your Firebase functions directory
 * 2. Install dependencies: npm install node-fetch
 * 3. Add to functions/index.js:
 *    const sportsFeed = require('./sportsFeed');
 *    exports.fetchSportsNews = sportsFeed.fetchSportsNews;
 * 4. Deploy: firebase deploy --only functions:fetchSportsNews
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Scheduled function to fetch sports injuries from ESPN API
 * Runs every 15 minutes to keep feed updated
 */
exports.fetchSportsNews = functions.pubsub
  .schedule('every 15 minutes')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('Starting sports news fetch...');
    
    const leagues = [
      { league: 'nba', sport: 'basketball' },
      { league: 'nfl', sport: 'football' },
      { league: 'nhl', sport: 'hockey' },
      { league: 'mlb', sport: 'baseball' }
    ];
    
    let totalProcessed = 0;
    let totalErrors = 0;
    
    for (const { league, sport } of leagues) {
      try {
        console.log(`Fetching injuries for ${league.toUpperCase()}...`);
        
        // Fetch injuries from ESPN API
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/injuries`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.injuries || data.injuries.length === 0) {
          console.log(`No injuries found for ${league.toUpperCase()}`);
          continue;
        }
        
        // Process injuries in batches
        const batch = db.batch();
        let batchCount = 0;
        
        for (const item of data.injuries) {
          // Generate a unique ID based on player and date
          const playerId = item.athlete?.id || Math.random().toString(36).substr(2, 9);
          const docId = `${league}-injury-${playerId}-${Date.now()}`;
          const docRef = db.collection('feed').doc(docId);
          
          const feedItem = {
            sport: league.toUpperCase(),
            type: 'injury',
            headline: `${item.athlete?.displayName || 'Player'} - ${item.status || 'Injury Update'}`,
            details: item.comment || item.details || item.longComment || '',
            player: item.athlete?.displayName || '',
            team: item.team?.displayName || '',
            publishedAt: admin.firestore.Timestamp.fromDate(new Date(item.date || Date.now())),
            url: item.athlete?.links?.[0]?.href || `https://www.espn.com/${sport}/${league}/`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'ESPN'
          };
          
          batch.set(docRef, feedItem, { merge: true });
          batchCount++;
          
          // Firestore has a limit of 500 operations per batch
          if (batchCount >= 400) {
            await batch.commit();
            totalProcessed += batchCount;
            batchCount = 0;
          }
        }
        
        // Commit remaining items
        if (batchCount > 0) {
          await batch.commit();
          totalProcessed += batchCount;
        }
        
        console.log(`Successfully processed ${batchCount} ${league.toUpperCase()} injuries`);
        
      } catch (error) {
        console.error(`Error fetching ${league} injuries:`, error);
        totalErrors++;
      }
    }
    
    // Clean up old feed items (older than 7 days)
    try {
      const sevenDaysAgo = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      
      const oldItemsSnapshot = await db.collection('feed')
        .where('createdAt', '<', sevenDaysAgo)
        .limit(100)
        .get();
      
      if (!oldItemsSnapshot.empty) {
        const deleteBatch = db.batch();
        oldItemsSnapshot.docs.forEach(doc => {
          deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        console.log(`Deleted ${oldItemsSnapshot.size} old feed items`);
      }
    } catch (error) {
      console.error('Error cleaning up old feed items:', error);
    }
    
    console.log(`Sports news fetch completed. Processed: ${totalProcessed}, Errors: ${totalErrors}`);
    return null;
  });

/**
 * HTTP callable function to manually trigger sports news fetch
 * Useful for testing or immediate updates
 */
exports.triggerSportsFetch = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to trigger sports fetch'
    );
  }
  
  // Check if user is admin
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  
  if (!userData || userData.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Must be admin to trigger sports fetch'
    );
  }
  
  // Trigger the fetch manually
  try {
    await exports.fetchSportsNews.run();
    return { success: true, message: 'Sports news fetch triggered successfully' };
  } catch (error) {
    console.error('Error triggering sports fetch:', error);
    throw new functions.https.HttpsError('internal', 'Failed to trigger sports fetch');
  }
});

/**
 * Alternative: Fetch from RSS feeds
 * Can be used as backup if ESPN API is unavailable
 */
exports.fetchSportsRSS = functions.pubsub
  .schedule('every 30 minutes')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('RSS feed parsing would go here');
    // Implementation would use an RSS parser library
    // Example: rss-parser npm package
    return null;
  });

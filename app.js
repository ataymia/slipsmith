// Main Application Logic for $lip$mith
// This file contains all the core functionality for authentication, 
// Firestore operations, Storage operations, and real-time features

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Login user with email and password
 */
async function loginUser(email, password) {
    try {
        const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
        console.log('User logged in:', userCredential.user.email);
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Logout current user
 */
async function logoutUser() {
    try {
        await firebaseAuth.signOut();
        console.log('User logged out');
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}

/**
 * Send password reset email
 */
async function resetPassword(email) {
    try {
        await firebaseAuth.sendPasswordResetEmail(email);
        console.log('Password reset email sent to:', email);
    } catch (error) {
        console.error('Password reset error:', error);
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Get current authenticated user
 */
async function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        }, reject);
    });
}

/**
 * Get user-friendly error messages
 */
function getAuthErrorMessage(code) {
    const messages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'Email already registered.',
        'auth/weak-password': 'Password is too weak.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.'
    };
    return messages[code] || 'An authentication error occurred.';
}

// ============================================================================
// FIRESTORE - USER DATA OPERATIONS
// ============================================================================

/**
 * Get user data from Firestore
 */
async function getUserData(userId) {
    try {
        const userDoc = await firebaseDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
            return { uid: userId, ...userDoc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting user data:', error);
        throw error;
    }
}

/**
 * Create or update user data
 */
async function setUserData(userId, data) {
    try {
        await firebaseDb.collection('users').doc(userId).set(data, { merge: true });
        console.log('User data updated for:', userId);
    } catch (error) {
        console.error('Error setting user data:', error);
        throw error;
    }
}

/**
 * Update user tier
 */
async function setUserTier(userId, tier) {
    try {
        await firebaseDb.collection('users').doc(userId).update({
            tier: tier,
            updatedAt: Date.now()
        });
        console.log('User tier updated:', userId, tier);
    } catch (error) {
        console.error('Error updating user tier:', error);
        throw error;
    }
}

/**
 * Get all users (admin only)
 */
async function getAllUsers() {
    try {
        const snapshot = await firebaseDb.collection('users').get();
        return snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting users:', error);
        throw error;
    }
}

// ============================================================================
// FIRESTORE - POSTS OPERATIONS
// ============================================================================

/**
 * Create a new post
 */
async function createPost(postData) {
    try {
        const post = {
            ...postData,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const docRef = await firebaseDb.collection('posts').add(post);
        console.log('Post created:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error creating post:', error);
        throw error;
    }
}

/**
 * Update an existing post
 */
async function updatePost(postId, postData) {
    try {
        await firebaseDb.collection('posts').doc(postId).update({
            ...postData,
            updatedAt: Date.now()
        });
        console.log('Post updated:', postId);
    } catch (error) {
        console.error('Error updating post:', error);
        throw error;
    }
}

/**
 * Delete a post
 */
async function removePost(postId) {
    try {
        await firebaseDb.collection('posts').doc(postId).delete();
        console.log('Post deleted:', postId);
    } catch (error) {
        console.error('Error deleting post:', error);
        throw error;
    }
}

/**
 * Get a single post by ID
 */
async function getPost(postId) {
    try {
        const doc = await firebaseDb.collection('posts').doc(postId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting post:', error);
        throw error;
    }
}

/**
 * Get all posts (admin only)
 */
async function getAllPosts() {
    try {
        const snapshot = await firebaseDb.collection('posts')
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting all posts:', error);
        throw error;
    }
}

/**
 * Get posts based on user tier
 * Tier hierarchy: starter < pro < vip
 */
async function getPostsByTier(userTier) {
    try {
        const tierLevels = { starter: 1, pro: 2, vip: 3 };
        const userLevel = tierLevels[userTier.toLowerCase()] || 1;
        
        // Get all posts
        const snapshot = await firebaseDb.collection('posts')
            .orderBy('createdAt', 'desc')
            .get();
        
        // Filter posts based on tier level
        const posts = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(post => {
                const postLevel = tierLevels[post.minTier.toLowerCase()] || 1;
                return userLevel >= postLevel;
            });
        
        console.log(`Loaded ${posts.length} posts for tier: ${userTier}`);
        return posts;
    } catch (error) {
        console.error('Error getting posts by tier:', error);
        throw error;
    }
}

// ============================================================================
// STORAGE - FILE UPLOAD OPERATIONS
// ============================================================================

/**
 * Upload media file to Firebase Storage
 */
async function uploadMedia(file) {
    try {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = firebaseStorage.ref(`media/${fileName}`);
        
        console.log('Uploading file:', fileName);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        console.log('File uploaded successfully:', downloadURL);
        return {
            url: downloadURL,
            name: fileName,
            type: file.type,
            size: file.size
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

/**
 * Delete media file from Firebase Storage
 */
async function deleteMedia(fileUrl) {
    try {
        const storageRef = firebaseStorage.refFromURL(fileUrl);
        await storageRef.delete();
        console.log('File deleted:', fileUrl);
    } catch (error) {
        console.error('Error deleting file:', error);
        // Don't throw - file might already be deleted
    }
}

// ============================================================================
// FIRESTORE - REAL-TIME CHAT (Pro/VIP only)
// ============================================================================

let chatUnsubscribe = null;

/**
 * Send a chat message
 */
async function sendChatMessage(messageData) {
    try {
        await firebaseDb.collection('chat').add(messageData);
        console.log('Message sent');
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

/**
 * Listen to chat messages in real-time
 */
function onChatMessages(callback) {
    // Unsubscribe from previous listener if exists
    if (chatUnsubscribe) {
        chatUnsubscribe();
    }
    
    // Subscribe to chat messages
    chatUnsubscribe = firebaseDb.collection('chat')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        }, error => {
            console.error('Error listening to chat:', error);
        });
    
    return chatUnsubscribe;
}

/**
 * Stop listening to chat messages
 */
function stopChatListener() {
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
        console.log('Chat listener stopped');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user has admin role
 */
async function isAdmin(userId) {
    try {
        const userData = await getUserData(userId);
        return userData?.role === 'admin';
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Check if user has access to chat (Pro or VIP)
 */
function hasChatAccess(tier) {
    return tier === 'pro' || tier === 'vip';
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('$lip$mith Application initialized');

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Prevent form submissions from refreshing the page
document.addEventListener('DOMContentLoaded', () => {
    // This helps ensure forms work correctly
    console.log('DOM loaded, application ready');
});

// Export functions to window for use in HTML
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.resetPassword = resetPassword;
window.getCurrentUser = getCurrentUser;
window.getUserData = getUserData;
window.setUserData = setUserData;
window.setUserTier = setUserTier;
window.getAllUsers = getAllUsers;
window.createPost = createPost;
window.updatePost = updatePost;
window.removePost = removePost;
window.getPost = getPost;
window.getAllPosts = getAllPosts;
window.getPostsByTier = getPostsByTier;
window.uploadMedia = uploadMedia;
window.deleteMedia = deleteMedia;
window.sendChatMessage = sendChatMessage;
window.onChatMessages = onChatMessages;
window.stopChatListener = stopChatListener;
window.isAdmin = isAdmin;
window.hasChatAccess = hasChatAccess;
window.formatDate = formatDate;
window.formatTime = formatTime;

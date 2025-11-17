// app.js - Main Application Logic for $lip$mith
// Unified auth state management with username setup and temporary password change flow

// ============================================================================
// FIREBASE SERVICES
// ============================================================================

// Get Firebase services from globals exposed in firebase.js
const auth = window.firebaseAuth;
const db = window.firebaseDb;
const storage = window.firebaseStorage;

if (!auth || !db) {
  console.error("Firebase services not found. Make sure firebase.js is loaded before app.js.");
}

// ============================================================================
// COMPATIBILITY HELPERS
// ============================================================================

/**
 * Safely get server timestamp with fallback
 * Returns firebase.firestore.FieldValue.serverTimestamp() if available,
 * otherwise returns Date.now() as fallback
 */
function getServerTimestamp() {
  try {
    if (typeof firebase !== 'undefined' && 
        firebase.firestore && 
        firebase.firestore.FieldValue && 
        firebase.firestore.FieldValue.serverTimestamp) {
      return firebase.firestore.FieldValue.serverTimestamp();
    }
    console.warn("firebase.firestore.FieldValue.serverTimestamp() not available, using Date.now() fallback");
    return Date.now();
  } catch (err) {
    console.error("Error accessing serverTimestamp, using Date.now() fallback:", err);
    return Date.now();
  }
}

/**
 * Compatible sign-in wrapper
 * Attempts auth.signInWithEmailAndPassword if available, otherwise throws clear error
 */
async function signInCompat(email, password) {
  if (!auth) {
    throw new Error("Firebase Auth not initialized. Check firebase.js is loaded.");
  }
  
  if (typeof auth.signInWithEmailAndPassword === 'function') {
    return await auth.signInWithEmailAndPassword(email, password);
  }
  
  throw new Error("auth.signInWithEmailAndPassword is not available. Ensure Firebase compat SDK is loaded correctly.");
}

// ============================================================================
// PAGE DETECTION
// ============================================================================

function getCurrentPage() {
  const path = window.location.pathname.toLowerCase();

  if (path.endsWith("login.html")) return "login";
  if (path.endsWith("portal.html")) return "portal";
  if (path.endsWith("admin.html")) return "admin";
  if (path.endsWith("plans.html")) return "plans";
  if (path.endsWith("index.html") || path === "/" || path === "") return "index";

  return "other";
}

// ============================================================================
// TIER ORDERING
// ============================================================================

const tierOrder = {
  starter: 1,
  pro: 2,
  vip: 3
};

// ============================================================================
// GLOBAL AUTH STATE
// ============================================================================

let currentUser = null;
let currentUserDoc = null; // Firestore user document data

function updateAdminLinkVisibility() {
  const adminLink = document.getElementById("admin-link");
  if (!adminLink) return;

  if (currentUser && currentUserDoc && currentUserDoc.role === "admin") {
    adminLink.style.display = "inline-block";
  } else {
    adminLink.style.display = "none";
  }
}

// ============================================================================
// AUTH STATE LISTENER (ROUTING + PAGE INIT)
// ============================================================================

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const page = getCurrentPage();

  if (!user) {
    currentUserDoc = null;
    updateAdminLinkVisibility();

    // Protected pages go to login
    if (page === "portal" || page === "admin") {
      window.location.href = "login.html";
      return;
    }

    // Public pages
    if (page === "plans") {
      initPlansPage();
    } else if (page === "login") {
      initLoginPage(); // no user, so show login form
    } else {
      initPublicPage(page);
    }
    return;
  }

  // User is logged in; load their Firestore profile
  try {
    const userDocRef = db.collection("users").doc(user.uid);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.error("============================================================");
      console.error("PROFILE ERROR: User profile not found in Firestore");
      console.error("User UID:", user.uid);
      console.error("User Email:", user.email);
      console.error("This user is authenticated but has no Firestore profile document.");
      console.error("Action needed: Create a profile document or contact support.");
      console.error("============================================================");
      
      // DO NOT sign out - instead show error to user
      currentUserDoc = null;
      updateAdminLinkVisibility();
      
      if (page === "login") {
        // Show error on login page
        initLoginPage();
        const errorDiv = document.getElementById("login-error");
        if (errorDiv) {
          errorDiv.textContent = "Your account exists but profile setup is incomplete. Please contact support.";
          errorDiv.style.display = "block";
        }
      } else if (page === "portal" || page === "admin") {
        // Show auth required message on protected pages
        const authRequired = document.getElementById("auth-required");
        if (authRequired) {
          authRequired.innerHTML = `
            <h2>⚠️ Profile Setup Required</h2>
            <p>Your account is authenticated but your profile is incomplete.</p>
            <p>User: ${user.email}</p>
            <p>Please contact support to complete your profile setup.</p>
            <button onclick="auth.signOut().then(() => window.location.href = 'login.html')" class="btn btn-primary">Sign Out</button>
          `;
          authRequired.style.display = "block";
        }
      }
      return;
    }

    currentUserDoc = userDocSnap.data();
    updateAdminLinkVisibility();

    const needsPasswordChange = !!currentUserDoc.mustChangePassword;
    const hasUsername = !!currentUserDoc.username;

    if (page === "admin") {
      if (currentUserDoc.role !== "admin") {
        window.location.href = "portal.html";
        return;
      }
      initAdminPage();
    } else if (page === "portal") {
      initPortalPage();
    } else if (page === "login") {
      // Logged-in user visiting login.html
      if (needsPasswordChange) {
        initLoginPage(false, true); // passwordOnly = true
      } else if (!hasUsername) {
        initLoginPage(true, false); // usernameOnly = true
      } else {
        window.location.href = "portal.html";
      }
    } else if (page === "plans") {
      initPlansPage();
    } else {
      initPublicPage(page);
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
  }
});

// ============================================================================
// LOGIN PAGE (USERNAME + TEMP PASSWORD HANDLING)
// ============================================================================

function initLoginPage(usernameOnly = false, passwordOnly = false) {
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const loginButton = document.getElementById("login-button");
  const errorDiv = document.getElementById("login-error");
  const loginForm = document.getElementById("login-form");

  const usernameSection = document.getElementById("username-setup");
  const usernameInput = document.getElementById("username-input");
  const usernameSaveButton = document.getElementById("username-save-button");
  const usernameErrorDiv = document.getElementById("username-error");

  const passwordSection = document.getElementById("password-change-section");
  const newPasswordInput = document.getElementById("new-password-input");
  const confirmPasswordInput = document.getElementById("confirm-password-input");
  const passwordSaveButton = document.getElementById("password-save-button");
  const passwordErrorDiv = document.getElementById("password-error");

  // Helpers to toggle sections
  function showLoginForm() {
    if (loginForm) loginForm.style.display = "";
    if (usernameSection) usernameSection.style.display = "none";
    if (passwordSection) passwordSection.style.display = "none";
  }

  function showUsernameForm() {
    if (loginForm) loginForm.style.display = "none";
    if (usernameSection) usernameSection.style.display = "";
    if (passwordSection) passwordSection.style.display = "none";
  }

  function showPasswordForm() {
    if (loginForm) loginForm.style.display = "none";
    if (usernameSection) usernameSection.style.display = "none";
    if (passwordSection) passwordSection.style.display = "";
  }

  function setLoginLoading(isLoading) {
    if (!loginButton) return;
    if (isLoading) {
      loginButton.disabled = true;
      loginButton.textContent = "Logging in...";
    } else {
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  }

  // Initial state based on parameters and currentUserDoc
  if (passwordOnly) {
    showPasswordForm();
  } else if (usernameOnly) {
    showUsernameForm();
  } else {
    showLoginForm();
  }

  // LOGIN FORM SUBMIT
  if (loginForm && emailInput && passwordInput && loginButton) {
    // Remove any existing listener by cloning the form
    const newLoginForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newLoginForm, loginForm);
    
    newLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorDiv) errorDiv.style.display = "none";
      if (errorDiv) errorDiv.textContent = "";

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      if (!email || !password) {
        if (errorDiv) {
          errorDiv.textContent = "Please enter both email and password.";
          errorDiv.style.display = "block";
        }
        return;
      }

      try {
        setLoginLoading(true);
        const result = await signInCompat(email, password);
        const user = result.user;

        const userDocRef = db.collection("users").doc(user.uid);
        const userDocSnap = await userDocRef.get();

        if (!userDocSnap.exists) {
          await auth.signOut();
          if (errorDiv) {
            errorDiv.textContent = "No profile found for this user. Please contact support.";
            errorDiv.style.display = "block";
          }
          setLoginLoading(false);
          return;
        }

        currentUser = user;
        currentUserDoc = userDocSnap.data();

        const needsPasswordChange = !!currentUserDoc.mustChangePassword;
        const hasUsername = !!currentUserDoc.username;

        if (needsPasswordChange) {
          showPasswordForm();
        } else if (!hasUsername) {
          showUsernameForm();
        } else {
          window.location.href = "portal.html";
        }
      } catch (err) {
        console.error("Login error:", err);
        let msg = "Login failed. Please check your email and password.";
        if (err.code === "auth/user-not-found") msg = "No user found with this email.";
        if (err.code === "auth/wrong-password") msg = "Incorrect password.";
        if (errorDiv) {
          errorDiv.textContent = msg;
          errorDiv.style.display = "block";
        }
      } finally {
        setLoginLoading(false);
      }
    });
  }

  // USERNAME SAVE HANDLER
  if (usernameSection && usernameInput && usernameSaveButton) {
    // Remove any existing listener
    const newUsernameSaveButton = usernameSaveButton.cloneNode(true);
    usernameSaveButton.parentNode.replaceChild(newUsernameSaveButton, usernameSaveButton);
    
    newUsernameSaveButton.addEventListener("click", async (e) => {
      e.preventDefault();
      const usernameError = document.getElementById("username-error");
      if (usernameError) usernameError.style.display = "none";
      if (usernameError) usernameError.textContent = "";

      const username = document.getElementById("username-input").value.trim();
      if (!username) {
        if (usernameError) {
          usernameError.textContent = "Please enter a username.";
          usernameError.style.display = "block";
        }
        return;
      }

      if (!currentUser) {
        if (usernameError) {
          usernameError.textContent = "You must be logged in to set a username.";
          usernameError.style.display = "block";
        }
        return;
      }

      try {
        await db.collection("users").doc(currentUser.uid).update({
          username: username,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (!currentUserDoc) currentUserDoc = {};
        currentUserDoc.username = username;

        // After setting username:
        // If mustChangePassword is still true, show password form; else go to portal.
        const needsPasswordChange = !!currentUserDoc.mustChangePassword;
        if (needsPasswordChange && passwordSection) {
          showPasswordForm();
        } else {
          window.location.href = "portal.html";
        }
      } catch (err) {
        console.error("Error saving username:", err);
        if (usernameError) {
          usernameError.textContent = "Could not save username. Please try again.";
          usernameError.style.display = "block";
        }
      }
    });
  }

  // PASSWORD CHANGE HANDLER
  if (passwordSection && newPasswordInput && confirmPasswordInput && passwordSaveButton) {
    // Remove any existing listener
    const newPasswordSaveButton = passwordSaveButton.cloneNode(true);
    passwordSaveButton.parentNode.replaceChild(newPasswordSaveButton, passwordSaveButton);
    
    newPasswordSaveButton.addEventListener("click", async (e) => {
      e.preventDefault();
      const passwordError = document.getElementById("password-error");
      if (passwordError) passwordError.style.display = "none";
      if (passwordError) passwordError.textContent = "";

      const newPass = document.getElementById("new-password-input").value;
      const confirmPass = document.getElementById("confirm-password-input").value;

      if (!newPass || !confirmPass) {
        if (passwordError) {
          passwordError.textContent = "Please fill out both password fields.";
          passwordError.style.display = "block";
        }
        return;
      }

      if (newPass !== confirmPass) {
        if (passwordError) {
          passwordError.textContent = "Passwords do not match.";
          passwordError.style.display = "block";
        }
        return;
      }

      if (!currentUser) {
        if (passwordError) {
          passwordError.textContent = "You must be logged in to change your password.";
          passwordError.style.display = "block";
        }
        return;
      }

      try {
        // Update password in Firebase Auth
        await currentUser.updatePassword(newPass);

        // Clear the mustChangePassword flag in Firestore
        await db.collection("users").doc(currentUser.uid).update({
          mustChangePassword: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (!currentUserDoc) currentUserDoc = {};
        currentUserDoc.mustChangePassword = false;

        // After password change:
        // If username is missing, show username setup; otherwise go to portal.
        if (!currentUserDoc.username && usernameSection) {
          showUsernameForm();
        } else {
          window.location.href = "portal.html";
        }
      } catch (err) {
        console.error("Error updating password:", err);
        let msg = "Could not update password. Please try again.";
        if (err.code === "auth/weak-password") {
          msg = "Password is too weak. Try a stronger one.";
        }
        if (passwordError) {
          passwordError.textContent = msg;
          passwordError.style.display = "block";
        }
      }
    });
  }
}

// ============================================================================
// LOGOUT HANDLER
// ============================================================================

function initLogoutHandler() {
  const logoutButton = document.getElementById("logout-button");
  if (!logoutButton) return;

  // Remove existing listener by cloning
  const newLogoutButton = logoutButton.cloneNode(true);
  logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);

  newLogoutButton.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await auth.signOut();
      window.location.href = "index.html";
    } catch (err) {
      console.error("Error signing out:", err);
    }
  });
}

// ============================================================================
// PLANS PAGE LOGIC
// ============================================================================

function initPlansPage() {
  initLogoutHandler();
  updateAdminLinkVisibility();

  const currentPlanLabel = document.getElementById("current-plan-label");
  const planCards = document.querySelectorAll("[data-plan-tier]");

  if (!currentUser || !currentUserDoc) {
    if (currentPlanLabel) {
      currentPlanLabel.textContent = "";
    }
    // Show default CTA for non-logged-in users
    planCards.forEach((card) => {
      const cta = card.querySelector(".plan-cta");
      if (cta) {
        cta.textContent = "Select";
        cta.disabled = false;
        // Add click handler to scroll to payment info
        cta.onclick = () => {
          document.getElementById("payment-info")?.scrollIntoView({ behavior: "smooth" });
        };
      }
    });
    return;
  }

  const userTier = (currentUserDoc.tier || "").toLowerCase();
  const userTierRank = tierOrder[userTier] || 0;

  if (currentPlanLabel) {
    const usernameText = currentUserDoc.username ? ` (${currentUserDoc.username})` : "";
    currentPlanLabel.textContent = `Your current plan: ${userTier ? userTier.toUpperCase() : "UNKNOWN"}${usernameText}`;
  }

  planCards.forEach((card) => {
    const cardTier = (card.getAttribute("data-plan-tier") || "").toLowerCase();
    const cardTierRank = tierOrder[cardTier] || 0;
    const cta = card.querySelector(".plan-cta");

    if (!cta || !cardTier) return;

    if (cardTierRank === userTierRank) {
      cta.textContent = "Current plan";
      cta.disabled = true;
    } else if (cardTierRank > userTierRank) {
      cta.textContent = "Upgrade";
      cta.disabled = false;
      cta.onclick = () => {
        document.getElementById("payment-info")?.scrollIntoView({ behavior: "smooth" });
      };
    } else {
      cta.textContent = "Included in your plan";
      cta.disabled = true;
    }
  });
}

// ============================================================================
// PORTAL PAGE
// ============================================================================

function initPortalPage() {
  initLogoutHandler();
  updateAdminLinkVisibility();

  const authRequired = document.getElementById("auth-required");
  const portalContent = document.getElementById("portal-content");

  if (!currentUser || !currentUserDoc) {
    if (authRequired) authRequired.style.display = "block";
    if (portalContent) portalContent.style.display = "none";
    return;
  }

  if (authRequired) authRequired.style.display = "none";
  if (portalContent) portalContent.style.display = "block";

  // Display user info
  const userInfo = document.getElementById("user-info");
  const tierBadge = document.getElementById("tier-badge");
  const tier = currentUserDoc.tier || "starter";

  if (userInfo) {
    const usernameText = currentUserDoc.username ? currentUserDoc.username : currentUser.email;
    userInfo.textContent = `${usernameText} | ${tier.toUpperCase()} Member`;
  }
  if (tierBadge) {
    tierBadge.textContent = tier.toUpperCase();
    tierBadge.className = `tier-badge tier-${tier.toLowerCase()}`;
  }

  // Show chat for Pro and VIP members
  const chatSection = document.getElementById("chat-section");
  if (chatSection && (tier === "pro" || tier === "vip")) {
    chatSection.style.display = "block";
    initializeChat();
  }

  // Load posts based on tier
  loadPosts(tier);
}

async function loadPosts(userTier) {
  const container = document.getElementById("posts-container");
  if (!container) return;

  try {
    const posts = await getPostsByTier(userTier);

    if (posts.length === 0) {
      container.innerHTML = '<p class="no-content">No posts available yet. Check back soon!</p>';
      return;
    }

    container.innerHTML = posts.map(post => `
      <div class="post-card">
        <div class="post-header">
          <h3>${post.title}</h3>
          <span class="post-tier tier-${post.minTier}">${post.minTier.toUpperCase()}</span>
        </div>
        <div class="post-meta">
          <span>📅 ${new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="post-content">
          ${post.content}
        </div>
        ${post.mediaUrl ? `
          <div class="post-media">
            ${post.mediaType?.startsWith('image') ?
              `<img src="${post.mediaUrl}" alt="${post.title}">` :
              `<a href="${post.mediaUrl}" target="_blank" class="btn btn-outline btn-sm">View Attachment</a>`
            }
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading posts:', error);
    container.innerHTML = '<p class="error">Error loading posts. Please try again.</p>';
  }
}

async function initializeChat() {
  const messagesContainer = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");

  if (!messagesContainer || !chatForm || !chatInput) return;

  // Listen for new messages
  onChatMessages((messages) => {
    messagesContainer.innerHTML = messages.map(msg => {
      const isOwn = msg.userId === currentUser.uid;
      return `
        <div class="chat-message ${isOwn ? 'own-message' : ''}">
          <div class="message-header">
            <span class="message-user">${msg.userName || 'Anonymous'}</span>
            <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="message-text">${msg.text}</div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Handle message sending
  const newChatForm = chatForm.cloneNode(true);
  chatForm.parentNode.replaceChild(newChatForm, chatForm);

  newChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById("chat-input").value.trim();
    if (!text) return;

    try {
      const userName = currentUserDoc.username || currentUser.email.split('@')[0];
      await sendChatMessage({
        text,
        userId: currentUser.uid,
        userName: userName,
        timestamp: Date.now()
      });
      document.getElementById("chat-input").value = '';
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  });
}

// ============================================================================
// ADMIN PAGE
// ============================================================================

function initAdminPage() {
  initLogoutHandler();
  updateAdminLinkVisibility();
  console.log("Admin page initialized. Admin user:", currentUser, currentUserDoc);
  // Admin page has its own inline script for now
}

// ============================================================================
// PUBLIC PAGE
// ============================================================================

function initPublicPage(page) {
  updateAdminLinkVisibility();
  console.log("Public page initialized:", page, "User:", currentUser, currentUserDoc);
}

// ============================================================================
// DOM CONTENT LOADED
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const page = getCurrentPage();

  if (page === "login") {
    initLoginPage();
  }

  initLogoutHandler();
});

// ============================================================================
// LEGACY FUNCTIONS (keeping for backwards compatibility with admin/portal pages)
// ============================================================================

async function loginUser(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    console.log('User logged in:', userCredential.user.email);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

async function logoutUser() {
  try {
    await auth.signOut();
    console.log('User logged out');
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

async function resetPassword(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

async function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

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

async function getUserData(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return { uid: userId, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
}

async function setUserData(userId, data) {
  try {
    await db.collection('users').doc(userId).set(data, { merge: true });
    console.log('User data updated for:', userId);
  } catch (error) {
    console.error('Error setting user data:', error);
    throw error;
  }
}

async function setUserTier(userId, tier) {
  try {
    await db.collection('users').doc(userId).update({
      tier: tier,
      updatedAt: Date.now()
    });
    console.log('User tier updated:', userId, tier);
  } catch (error) {
    console.error('Error updating user tier:', error);
    throw error;
  }
}

async function getAllUsers() {
  try {
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
}

async function createPost(postData) {
  try {
    const post = {
      ...postData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const docRef = await db.collection('posts').add(post);
    console.log('Post created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}

async function updatePost(postId, postData) {
  try {
    await db.collection('posts').doc(postId).update({
      ...postData,
      updatedAt: Date.now()
    });
    console.log('Post updated:', postId);
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
}

async function removePost(postId) {
  try {
    await db.collection('posts').doc(postId).delete();
    console.log('Post deleted:', postId);
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

async function getPost(postId) {
  try {
    const doc = await db.collection('posts').doc(postId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting post:', error);
    throw error;
  }
}

async function getAllPosts() {
  try {
    const snapshot = await db.collection('posts')
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

async function getPostsByTier(userTier) {
  try {
    const tierLevels = { starter: 1, pro: 2, vip: 3 };
    const userLevel = tierLevels[userTier.toLowerCase()] || 1;

    // Get all posts
    const snapshot = await db.collection('posts')
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

async function uploadMedia(file) {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = storage.ref(`media/${fileName}`);

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

async function deleteMedia(fileUrl) {
  try {
    const storageRef = storage.refFromURL(fileUrl);
    await storageRef.delete();
    console.log('File deleted:', fileUrl);
  } catch (error) {
    console.error('Error deleting file:', error);
    // Don't throw - file might already be deleted
  }
}

let chatUnsubscribe = null;

async function sendChatMessage(messageData) {
  try {
    await db.collection('chat').add(messageData);
    console.log('Message sent');
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

function onChatMessages(callback) {
  // Unsubscribe from previous listener if exists
  if (chatUnsubscribe) {
    chatUnsubscribe();
  }

  // Subscribe to chat messages
  chatUnsubscribe = db.collection('chat')
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

function stopChatListener() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
    console.log('Chat listener stopped');
  }
}

async function isAdmin(userId) {
  try {
    const userData = await getUserData(userId);
    return userData?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

function hasChatAccess(tier) {
  return tier === 'pro' || tier === 'vip';
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

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

console.log('$lip$mith Application initialized with unified auth flow');

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

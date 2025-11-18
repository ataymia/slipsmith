// app.js - Main Application Logic for $lip$mith
// Unified auth state management with username setup and temporary password change flow

// ============================================================================
// FIREBASE SERVICES
// ============================================================================

// Get Firebase services from globals exposed in firebase.js
// Use defensive fallback to support both window.auth and window.firebaseAuth
const auth = window.auth || window.firebaseAuth;
const db = window.db || window.firebaseDb;
const storage = window.storage || window.firebaseStorage;
const functions = window.functions || window.firebaseFunctions;

if (!auth || !db) {
  console.error("Firebase services not found. Make sure firebase.js is loaded before app.js.");
}
if (!functions) {
  console.warn("Firebase Functions not found. Admin user manager will not work.");
}

// ============================================================================
// AUTH HELPER - Centralized authentication state management
// ============================================================================

const Auth = {
  /**
   * Get the current authentication token from localStorage
   * @returns {string|null} The token if it exists, null otherwise
   */
  getToken: function() {
    return localStorage.getItem('authToken');
  },

  /**
   * Set the authentication token in localStorage
   * @param {string} token - The token to store
   */
  setToken: function(token) {
    if (token) {
      localStorage.setItem('authToken', token);
    }
  },

  /**
   * Clear the authentication token from localStorage
   */
  clearToken: function() {
    localStorage.removeItem('authToken');
  },

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user is authenticated, false otherwise
   */
  isAuthenticated: function() {
    // Check both Firebase auth state and our token
    return !!(currentUser && currentUserDoc);
  }
};

/**
 * Update the UI based on authentication state
 * This function shows/hides UI elements based on whether user is logged in
 */
function updateAuthUI() {
  const isAuth = Auth.isAuthenticated();
  
  // Get all UI elements that need to be shown/hidden
  const accountLinks = document.querySelectorAll('#account-link, #account-btn');
  const inboxLinks = document.querySelectorAll('#inbox-link');
  const logoutButtons = document.querySelectorAll('#logout-button, #logout-btn');
  const loginLinks = document.querySelectorAll('a[href="login.html"]');
  
  // Show/hide account links
  accountLinks.forEach(el => {
    if (el) {
      if (isAuth) {
        el.classList.remove('hidden');
        el.style.display = ''; // Clear inline styles
      } else {
        el.classList.add('hidden');
      }
    }
  });
  
  // Show/hide inbox links
  inboxLinks.forEach(el => {
    if (el) {
      if (isAuth) {
        el.classList.remove('hidden');
        el.style.display = ''; // Clear inline styles
      } else {
        el.classList.add('hidden');
      }
    }
  });
  
  // Show/hide logout buttons
  logoutButtons.forEach(el => {
    if (el) {
      if (isAuth) {
        el.classList.remove('hidden');
        el.style.display = ''; // Clear inline styles
      } else {
        el.classList.add('hidden');
      }
    }
  });
  
  // Show/hide login links (opposite of account/logout)
  loginLinks.forEach(el => {
    if (el) {
      if (isAuth) {
        el.classList.add('hidden');
      } else {
        el.classList.remove('hidden');
        el.style.display = ''; // Clear inline styles
      }
    }
  });
  
  // Update admin link visibility (existing functionality)
  updateAdminLinkVisibility();
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

/**
 * Detects the current page from the URL pathname.
 * 
 * WHY THIS MATTERS:
 * This function must recognize BOTH legacy filename-based routes (e.g. /login.html)
 * AND modern clean URLs (e.g. /login) to ensure page initialization runs correctly.
 * 
 * SECURITY CONCERN:
 * If getCurrentPage() returns "other" for /login, initLoginPage() never runs,
 * the form submit handler is never attached, and the login form performs a
 * standard HTML GET submit — exposing user credentials in the URL.
 * 
 * SOLUTION:
 * This implementation normalizes the path (removes trailing slash, lowercases)
 * and matches against both patterns to ensure proper page detection regardless
 * of whether the server/CDN uses clean URLs or traditional .html extensions.
 */
function getCurrentPage() {
  const path = window.location.pathname.toLowerCase();
  // Normalize: remove trailing slash (so "/login/" -> "/login")
  const normalized = (path.endsWith("/") && path.length > 1) ? path.slice(0, -1) : path;

  // Recognize both pretty routes and legacy filename-based routes
  if (normalized.endsWith("login.html") || normalized.endsWith("/login")) return "login";
  if (normalized.endsWith("portal.html") || normalized.endsWith("/portal")) return "portal";
  if (normalized.endsWith("admin.html") || normalized.endsWith("/admin")) return "admin";
  if (normalized.endsWith("plans.html") || normalized.endsWith("/plans")) return "plans";
  if (normalized.endsWith("account.html") || normalized.endsWith("/account")) return "account";
  if (normalized.endsWith("inbox.html") || normalized.endsWith("/inbox")) return "inbox";
  if (normalized.endsWith("index.html") || normalized === "/" || normalized === "") return "index";

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
  
  // Show admin link only for admins
  if (adminLink) {
    if (currentUser && currentUserDoc && currentUserDoc.role === "admin") {
      adminLink.classList.remove('hidden');
      adminLink.style.display = "";
    } else {
      adminLink.classList.add('hidden');
    }
  }
}

// ============================================================================
// AUTH STATE LISTENER (ROUTING + PAGE INIT)
// ============================================================================

// DEBUG: verbose auth state logging to diagnose login redirect issue
// Replace the existing auth.onAuthStateChanged(...) handler with this block.

auth.onAuthStateChanged(async (user) => {
  // Lightweight helper to print a standard debug object
  function logDebug(stage, extra = {}) {
    const page = getCurrentPage();
    console.groupCollapsed(`[DEBUG][auth] ${stage} — page=${page}`);
    try {
      console.log('auth.currentUser', auth && auth.currentUser);
      console.log('window.firebaseAuth.currentUser', window.firebaseAuth && window.firebaseAuth.currentUser);
      console.log('window.auth (window.auth.currentUser)', window.auth && window.auth.currentUser);
    } catch (e) {
      console.log('error reading auth globals', e);
    }
    console.log('app currentUser variable', currentUser);
    console.log('app currentUserDoc variable', currentUserDoc);
    console.log('stored token (Auth.getToken)', (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : null);
    try {
      console.log('localStorage authToken present?', !!localStorage.getItem('authToken'));
    } catch (e) {
      console.log('localStorage read error', e);
    }
    if (extra.note) console.log('note:', extra.note);
    if (extra.err) console.log('error:', extra.err);
    console.groupEnd();
  }

  logDebug('onAuthStateChanged - ENTER', { note: `raw user object present? ${!!user}` });

  currentUser = user;
  const page = getCurrentPage();

  // If no user -> existing behavior
  if (!user) {
    logDebug('no user - routing to public/login if necessary', { note: 'User is null or signed out' });
    currentUserDoc = null;
    Auth.clearToken && Auth.clearToken();
    updateAuthUI();

    if (page === "portal" || page === "admin" || page === "account" || page === "inbox") {
      console.log('[auth routing] redirecting to login.html because user is not authenticated');
      window.location.href = "login.html";
      return;
    }

    if (page === "plans") {
      initPlansPage();
    } else if (page === "login") {
      initLoginPage(); // show login form
    } else {
      initPublicPage(page);
    }
    return;
  }

  // User is present — log and attempt to load user profile
  logDebug('user present - attempting to load profile', { note: `uid=${user.uid} email=${user.email}` });

  try {
    const userDocRef = db.collection("users").doc(user.uid);
    let userDocSnap = await userDocRef.get();

    logDebug('after user doc fetch', { note: `userDocSnap.exists=${userDocSnap.exists}` });

    // If missing, try to create minimal profile (if you previously added fallback)
    if (!userDocSnap.exists) {
      console.warn('[auth debug] profile missing - attempting minimal profile creation');
      try {
        const minimalProfile = {
          email: user.email || null,
          createdAt: getServerTimestamp(),
          tier: "starter",
          username: null,
          mustChangePassword: false
        };
        await userDocRef.set(minimalProfile, { merge: true });
        userDocSnap = await userDocRef.get();
        logDebug('after profile creation attempt', { note: `created? ${userDocSnap.exists}` });
      } catch (createErr) {
        logDebug('profile creation failed', { err: createErr });
        // Fall back to showing the profile-setup-required UI (existing behavior)
        currentUserDoc = null;
        updateAuthUI();
        if (page === "login") {
          initLoginPage();
          const errorDiv = document.getElementById("login-error");
          if (errorDiv) {
            errorDiv.textContent = "Your account exists but profile setup is incomplete. Please contact support.";
            errorDiv.style.display = "block";
          }
        } else if (page === "portal" || page === "admin") {
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
    }

    // If we reach here, we have a userDocSnap
    currentUserDoc = userDocSnap.exists ? userDocSnap.data() : null;
    logDebug('final userDoc loaded', { note: `username=${currentUserDoc && currentUserDoc.username} mustChangePassword=${currentUserDoc && !!currentUserDoc.mustChangePassword}` });

    // store token and update UI
    Auth.setToken && Auth.setToken(user.uid);
    updateAuthUI();

    const needsPasswordChange = !!currentUserDoc.mustChangePassword;
    const hasUsername = !!currentUserDoc.username;

    logDebug('routing decision', { note: `needsPasswordChange=${needsPasswordChange} hasUsername=${hasUsername} page=${page}` });

    if (page === "admin") {
      // Don't redirect - let admin.html handle showing appropriate error message
      initAdminPage();
    } else if (page === "portal") {
      initPortalPage();
    } else if (page === "account") {
      initAccountPage();
    } else if (page === "inbox") {
      initInboxPage();
    } else if (page === "login") {
      // Logged-in user visiting login.html
      if (needsPasswordChange) {
        console.log('[auth routing] user needs password change -> showing password setup');
        initLoginPage(false, true); // passwordOnly = true
      } else if (!hasUsername) {
        console.log('[auth routing] user missing username -> showing username setup');
        initLoginPage(true, false); // usernameOnly = true
      } else {
        console.log('[auth routing] user fully setup -> redirecting to portal.html');
        window.location.href = "portal.html";
      }
    } else if (page === "plans") {
      initPlansPage();
    } else {
      initPublicPage(page);
    }
  } catch (err) {
    logDebug('error fetching user profile', { err });
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
        
        // Auth token will be set by onAuthStateChanged handler
        // Don't redirect here - let onAuthStateChanged handle it
        // This prevents race conditions and duplicate redirects
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
        // Check if username is already taken (excluding current user)
        const usernameCheck = await db.collection("users")
          .where("username", "==", username)
          .get();
        
        const isTaken = usernameCheck.docs.some(doc => doc.id !== currentUser.uid);
        
        if (isTaken) {
          if (usernameError) {
            usernameError.textContent = "Username is already taken. Please choose another one.";
            usernameError.style.display = "block";
          }
          return;
        }

        await db.collection("users").doc(currentUser.uid).update({
          username: username,
          updatedAt: getServerTimestamp()
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
          updatedAt: getServerTimestamp()
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
      Auth.clearToken();
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
  updateAuthUI();

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
  updateAuthUI();

  const authRequired = document.getElementById("auth-required");
  const portalContent = document.getElementById("portal-content");

  if (!currentUser || !currentUserDoc) {
    if (authRequired) authRequired.style.display = "block";
    if (portalContent) portalContent.style.display = "none";
    return;
  }

  if (authRequired) authRequired.style.display = "none";
  if (portalContent) portalContent.style.display = "block";
  
  // Update presence on portal page
  updatePresence();
  
  // Update presence every 2 minutes
  setInterval(updatePresence, 2 * 60 * 1000);

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

  // Initialize slip request section
  initSlipRequestForPortal();
  
  // Initialize sports feed
  initSportsFeed();
}

// ============================================================================
// LIVE SPORTS FEED
// ============================================================================

let currentSportFilter = 'all';

function initSportsFeed() {
  const filterButtons = document.querySelectorAll('.sport-filter-btn');
  const feedContainer = document.getElementById('feed-items-container');
  
  if (!filterButtons || !feedContainer) return;
  
  // Setup filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active button
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update filter
      currentSportFilter = btn.getAttribute('data-sport');
      loadSportsFeed();
    });
  });
  
  // Load initial feed
  loadSportsFeed();
}

async function loadSportsFeed() {
  const feedContainer = document.getElementById('feed-items-container');
  if (!feedContainer) return;
  
  try {
    feedContainer.innerHTML = '<div class="no-feed-items">Loading sports news...</div>';
    
    // Query feed collection
    let query = db.collection('feed').orderBy('publishedAt', 'desc').limit(50);
    
    // Apply sport filter if not 'all'
    if (currentSportFilter !== 'all') {
      query = query.where('sport', '==', currentSportFilter);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      feedContainer.innerHTML = `
        <div class="no-feed-items">
          <p>No ${currentSportFilter === 'all' ? '' : currentSportFilter + ' '}news available yet.</p>
          <p style="margin-top: 0.5rem; font-size: 0.9rem;">Sports news integration coming soon! This will include:</p>
          <ul style="text-align: left; margin-top: 0.5rem; padding-left: 2rem;">
            <li>Injury reports & updates</li>
            <li>Player suspensions</li>
            <li>Line movements</li>
            <li>Depth chart changes</li>
            <li>Breaking news & analysis</li>
          </ul>
        </div>
      `;
      return;
    }
    
    const feedItems = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    renderFeedItems(feedItems);
  } catch (error) {
    console.error('Error loading sports feed:', error);
    feedContainer.innerHTML = `
      <div class="no-feed-items">
        <p>Unable to load sports feed at this time.</p>
        <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Please try again later.</p>
      </div>
    `;
  }
}

function renderFeedItems(items) {
  const feedContainer = document.getElementById('feed-items-container');
  if (!feedContainer) return;
  
  if (items.length === 0) {
    feedContainer.innerHTML = '<div class="no-feed-items">No news items found.</div>';
    return;
  }
  
  feedContainer.innerHTML = items.map(item => {
    const typeIcon = getFeedTypeIcon(item.type);
    const publishedDate = item.publishedAt?.toDate ? 
      item.publishedAt.toDate().toLocaleString() : 
      new Date(item.publishedAt).toLocaleString();
    
    return `
      <div class="feed-item ${item.type || 'news'}">
        <div class="feed-item-header">
          <span class="feed-item-type ${item.type || 'news'}">
            ${typeIcon} ${item.type || 'news'}
          </span>
          <span class="feed-item-sport">${item.sport || 'Sports'}</span>
        </div>
        <div class="feed-item-headline">${item.headline || 'No headline'}</div>
        ${item.details ? `<div class="feed-item-details">${item.details}</div>` : ''}
        ${item.player ? `<div class="feed-item-details"><strong>Player:</strong> ${item.player}</div>` : ''}
        ${item.team ? `<div class="feed-item-details"><strong>Team:</strong> ${item.team}</div>` : ''}
        <div class="feed-item-footer">
          <span>${publishedDate}</span>
          ${item.url ? `<a href="${item.url}" target="_blank" class="feed-item-link">Read more →</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function getFeedTypeIcon(type) {
  const icons = {
    injury: '🚑',
    suspension: '⚠️',
    news: '📰',
    line_movement: '📊',
    depth_chart: '📋'
  };
  return icons[type] || '📰';
}

// Listen for real-time updates to the feed
function setupFeedListener() {
  if (!db) return;
  
  let query = db.collection('feed').orderBy('publishedAt', 'desc').limit(50);
  
  if (currentSportFilter !== 'all') {
    query = query.where('sport', '==', currentSportFilter);
  }
  
  query.onSnapshot((snapshot) => {
    const feedItems = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    renderFeedItems(feedItems);
  }, (error) => {
    console.error('Error listening to feed updates:', error);
  });
}

// ============================================================================
// SLIP REQUEST FOR PORTAL
// ============================================================================

function initSlipRequestForPortal() {
  const section = document.getElementById("slip-request-section");
  const info = document.getElementById("slip-request-info");
  const openButton = document.getElementById("open-slip-request-button");
  const modal = document.getElementById("slip-request-modal");
  const closeButton = document.getElementById("close-slip-request-modal");
  const form = document.getElementById("slip-request-form");

  if (!section || !currentUser || !currentUserDoc) return;

  const tier = currentUserDoc.tier || "starter";
  const isPro = tier === "pro";
  const isVip = tier === "vip";

  if (!isPro && !isVip) {
    section.style.display = "none";
    return;
  }

  section.style.display = "";
  const maxRequests = isVip ? 7 : 2;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Load existing request count for this month
  db.collection("slipRequests")
    .where("userId", "==", currentUser.uid)
    .where("monthKey", "==", monthKey)
    .get()
    .then((snapshot) => {
      const count = snapshot.size;
      if (info) {
        info.textContent = `You have used ${count} of ${maxRequests} slip requests for ${monthKey}.`;
      }
      if (count >= maxRequests && openButton) {
        openButton.disabled = true;
        openButton.textContent = "Request Limit Reached";
      }
    })
    .catch((err) => {
      console.error("Error loading slip request count:", err);
      if (info) {
        info.textContent = "Unable to load slip request usage.";
      }
    });

  // Modal handlers
  if (openButton && modal) {
    openButton.addEventListener("click", () => {
      modal.style.display = "flex";
    });
  }

  if (closeButton && modal) {
    closeButton.addEventListener("click", () => {
      modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  }

  if (!form) return;

  // Remove existing listener by cloning
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  document.getElementById("slip-request-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusDiv = document.getElementById("slip-request-status");
    const sportSelect = document.getElementById("slip-request-sport");
    const textArea = document.getElementById("slip-request-text");
    const submitBtn = document.getElementById("slip-request-submit");
    
    if (!statusDiv || !sportSelect || !textArea || !submitBtn) return;

    statusDiv.textContent = "";
    const sport = sportSelect.value;
    const requestText = textArea.value.trim();

    if (!sport) {
      statusDiv.textContent = "Please select a sport.";
      return;
    }
    if (!requestText) {
      statusDiv.textContent = "Please describe your request.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      // Re-check count to avoid double-submits
      const snap = await db.collection("slipRequests")
        .where("userId", "==", currentUser.uid)
        .where("monthKey", "==", monthKey)
        .get();

      const used = snap.size;
      if (used >= maxRequests) {
        statusDiv.textContent = "You have already used your slip request limit for this month.";
        return;
      }

      const nowTs = getServerTimestamp();

      await db.collection("slipRequests").add({
        userId: currentUser.uid,
        userEmail: currentUser.email || currentUserDoc.email || "",
        username: currentUserDoc.username || "",
        tier,
        sport,
        requestText,
        status: "pending",
        responseSlip: null,
        monthKey,
        createdAt: nowTs,
        updatedAt: nowTs
      });

      statusDiv.textContent = "Your slip request has been submitted.";
      textArea.value = "";
      sportSelect.value = "";
      
      // Refresh the count display
      const newSnap = await db.collection("slipRequests")
        .where("userId", "==", currentUser.uid)
        .where("monthKey", "==", monthKey)
        .get();
      const newCount = newSnap.size;
      if (info) {
        info.textContent = `You have used ${newCount} of ${maxRequests} slip requests for ${monthKey}.`;
      }
      if (newCount >= maxRequests && openButton) {
        openButton.disabled = true;
        openButton.textContent = "Request Limit Reached";
      }

      // Close modal after delay
      setTimeout(() => {
        document.getElementById("slip-request-modal").style.display = "none";
        statusDiv.textContent = "";
      }, 2000);
    } catch (err) {
      console.error("Error submitting slip request:", err);
      statusDiv.textContent = "Failed to submit slip request. Please try again.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit slip request";
    }
  });
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

    container.innerHTML = posts.map(post => {
      // Determine if post is from bot
      const isBot = post.authorType === 'bot' || post.authorName === 'Slipsmith Bot';
      const botBadge = isBot ? '<span class="badge-author-bot">Bot</span>' : '';
      
      return `
        <div class="post-card">
          <div class="post-header">
            <h3>${post.title}</h3>
            <div>
              <span class="post-tier tier-${post.minTier}">${post.minTier.toUpperCase()}</span>
              ${botBadge}
            </div>
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
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading posts:', error);
    container.innerHTML = '<p class="error">Error loading posts. Please try again.</p>';
  }
}

async function initializeChat() {
  const messagesContainer = document.getElementById("chat-messages");
  let chatForm = document.getElementById("chat-form");

  if (!messagesContainer || !chatForm) return;

  // 🔁 Replace the form first so we don't keep stale event handlers
  const newChatForm = chatForm.cloneNode(true);
  chatForm.parentNode.replaceChild(newChatForm, chatForm);
  chatForm = newChatForm;

  // NOW re-grab all DOM elements from the new form
  const chatInput = document.getElementById("chat-input");
  const imageButton = document.getElementById("chat-image-button");
  const imageInput = document.getElementById("chat-image-input");
  const imagePreview = document.getElementById("chat-image-preview");
  const previewImg = document.getElementById("chat-preview-img");
  const removeImageBtn = document.getElementById("chat-remove-image");

  if (!chatInput) return;

  let selectedImage = null;

  // Handle image selection button
  if (imageButton && imageInput) {
    imageButton.addEventListener('click', () => {
      imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        selectedImage = file;
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Handle remove image preview
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
      selectedImage = null;
      imageInput.value = '';
      imagePreview.style.display = 'none';
      previewImg.src = '';
    });
  }

  // Check if current user is admin
  const isAdmin = currentUserDoc && currentUserDoc.role === 'admin';

  // Listen for new messages
  onChatMessages((messages) => {
    messagesContainer.innerHTML = messages.map(msg => {
      const isOwn = msg.userId === currentUser.uid;
      const canDelete = isAdmin || isOwn;
      const imageHtml = msg.imageUrl ? `
        <div class="message-image">
          <img src="${msg.imageUrl}" alt="Shared image" onclick="window.open('${msg.imageUrl}', '_blank')">
        </div>
      ` : '';
      
      const deleteBtn = canDelete ? `
        <button class="btn-delete-message" onclick="window.deleteChatMessageById('${msg.id}')">Delete</button>
      ` : '';
      
      // Prefer username over email, with fallback to userName for backwards compatibility
      const displayName = msg.fromUsername || msg.userName || msg.fromEmail || 'Anonymous';
      
      return `
        <div class="chat-message ${isOwn ? 'own-message' : ''}" data-message-id="${msg.id}">
          <div class="message-header">
            <span class="message-user">${displayName}</span>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
              ${deleteBtn}
            </div>
          </div>
          ${msg.text ? `<div class="message-text">${msg.text}</div>` : ''}
          ${imageHtml}
        </div>
      `;
    }).join('');

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Handle message sending
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    
    // Allow sending if there's text or an image
    if (!text && !selectedImage) return;

    try {
      const userName = currentUserDoc.username || currentUser.email.split('@')[0];
      const messageData = {
        text: text || '',
        userId: currentUser.uid,
        userName: userName, // Keep for backwards compatibility
        fromUsername: currentUserDoc.username || '',
        fromEmail: currentUser.email || '',
        fromUserId: currentUser.uid,
        timestamp: Date.now()
      };

      // Upload image if selected
      if (selectedImage) {
        const uploadResult = await uploadChatImage(selectedImage);
        messageData.imageUrl = uploadResult.url;
        messageData.imagePath = uploadResult.path;
      }

      await sendChatMessage(messageData);
      
      // Clear input and image
      chatInput.value = '';
      selectedImage = null;
      imageInput.value = '';
      imagePreview.style.display = 'none';
      previewImg.src = '';
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  });
}

// ============================================================================
// ACCOUNT PAGE
// ============================================================================

function initAccountPage() {
  initLogoutHandler();
  updateAuthUI();

  const authRequired = document.getElementById("auth-required");
  const accountContent = document.getElementById("account-content");

  if (!currentUser || !currentUserDoc) {
    // Show auth required message
    if (authRequired) authRequired.style.display = "block";
    if (accountContent) accountContent.style.display = "none";
    return;
  }

  // Hide auth required, show content
  if (authRequired) authRequired.style.display = "none";
  if (accountContent) accountContent.style.display = "block";

  const emailSpan = document.getElementById("account-email");
  const usernameInput = document.getElementById("account-username-input");
  const usernameSaveButton = document.getElementById("account-username-save");
  const usernameStatus = document.getElementById("account-username-status");
  const usernameSection = document.getElementById("account-username-section");

  const subscriptionLabel = document.getElementById("account-subscription-label");

  const newPasswordInput = document.getElementById("account-new-password-input");
  const confirmPasswordInput = document.getElementById("account-confirm-password-input");
  const passwordSaveButton = document.getElementById("account-password-save-button");
  const passwordStatus = document.getElementById("account-password-status");

  const deleteButton = document.getElementById("account-delete-button");
  const deleteStatus = document.getElementById("account-delete-status");

  // 1) Show email and username
  if (emailSpan) {
    emailSpan.textContent = currentUserDoc.email || currentUser.email || "";
  }

  if (usernameInput) {
    usernameInput.value = currentUserDoc.username || "";
    
    // Show "No username set yet" if username is not set
    if (!currentUserDoc.username) {
      if (usernameStatus) {
        usernameStatus.textContent = "No username set yet";
        usernameStatus.className = "account-status";
      }
      // Add visual indicator
      if (usernameSection) {
        usernameSection.classList.add("needs-username");
      }
    }
  }

  // 2) Subscription days left
  if (subscriptionLabel) {
    const expires = currentUserDoc.subscriptionEndsAt;
    if (!expires) {
      subscriptionLabel.textContent = "No expiration date set for your subscription.";
    } else {
      try {
        const expiresDate = expires.toDate ? expires.toDate() : new Date(expires);
        const now = new Date();
        const diffMs = expiresDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          subscriptionLabel.textContent = `Your ${currentUserDoc.tier || "current"} subscription has expired.`;
        } else if (diffDays === 0) {
          subscriptionLabel.textContent = `Your ${currentUserDoc.tier || "current"} subscription expires today.`;
        } else {
          subscriptionLabel.textContent = `You have ${diffDays} day(s) left on your ${currentUserDoc.tier || "current"} subscription.`;
        }
      } catch (e) {
        console.error("Error computing subscription days:", e);
        subscriptionLabel.textContent = "Unable to determine subscription expiration.";
      }
    }
  }

  // 3) Username change handler with Cloud Function
  if (usernameSaveButton && usernameInput && usernameStatus) {
    usernameSaveButton.addEventListener("click", async (e) => {
      e.preventDefault();
      usernameStatus.textContent = "";
      usernameStatus.className = "account-status";

      const desiredUsername = usernameInput.value.trim();
      
      // Client-side validation
      if (!desiredUsername) {
        usernameStatus.textContent = "Username is required.";
        usernameStatus.className = "account-status error";
        return;
      }
      
      if (desiredUsername.length < 3 || desiredUsername.length > 20) {
        usernameStatus.textContent = "Username must be between 3 and 20 characters.";
        usernameStatus.className = "account-status error";
        return;
      }
      
      // Only allow letters, numbers, underscores, and periods
      if (!/^[a-zA-Z0-9._]+$/.test(desiredUsername)) {
        usernameStatus.textContent = "Username can only contain letters, numbers, periods, and underscores.";
        usernameStatus.className = "account-status error";
        return;
      }

      try {
        // Call the Cloud Function
        const claimUsernameFn = functions.httpsCallable("claimUsername");
        usernameStatus.textContent = "Saving username...";
        usernameStatus.className = "account-status pending";

        const result = await claimUsernameFn({ username: desiredUsername });
        const finalUsername = result.data.username;
        
        usernameInput.value = finalUsername || desiredUsername;
        currentUserDoc.username = finalUsername || desiredUsername;
        usernameStatus.textContent = "Username saved!";
        usernameStatus.className = "account-status success";
        
        // Remove needs-username indicator
        if (usernameSection) {
          usernameSection.classList.remove("needs-username");
        }
      } catch (error) {
        console.error("Error claiming username:", error);
        
        if (error.code === "functions/invalid-argument" || error.code === "username-invalid") {
          usernameStatus.textContent = error.message || "Invalid username format.";
        } else if (error.code === "username-taken") {
          usernameStatus.textContent = "That username is already taken. Please choose another.";
        } else {
          usernameStatus.textContent = "Could not save username. Please try again.";
        }
        usernameStatus.className = "account-status error";
      }
    });
  }

  // 4) Password change handler
  if (passwordSaveButton && newPasswordInput && confirmPasswordInput) {
    passwordSaveButton.addEventListener("click", async (e) => {
      e.preventDefault();
      if (passwordStatus) passwordStatus.textContent = "";

      const newPass = newPasswordInput.value;
      const confirmPass = confirmPasswordInput.value;

      if (!newPass || !confirmPass) {
        if (passwordStatus) passwordStatus.textContent = "Please fill out both password fields.";
        return;
      }

      if (newPass !== confirmPass) {
        if (passwordStatus) passwordStatus.textContent = "Passwords do not match.";
        return;
      }

      try {
        await currentUser.updatePassword(newPass);

        // Clear any mustChangePassword flag if you use it
        try {
          const userDocRef = window.firebaseDb.collection("users").doc(currentUser.uid);
          await userDocRef.update({
            mustChangePassword: false,
            updatedAt: getServerTimestamp()
          });
          currentUserDoc.mustChangePassword = false;
        } catch (innerErr) {
          console.warn("Could not update mustChangePassword flag:", innerErr);
        }

        if (passwordStatus) passwordStatus.textContent = "Password updated successfully.";
        newPasswordInput.value = "";
        confirmPasswordInput.value = "";
      } catch (err) {
        console.error("Error updating password:", err);
        let msg = "Failed to update password. Please try again.";
        if (err.code === "auth/requires-recent-login") {
          msg = "For security, please log out and log back in, then try changing your password again.";
        }
        if (passwordStatus) passwordStatus.textContent = msg;
      }
    });
  }

  // 5) Delete account handler
  if (deleteButton) {
    deleteButton.addEventListener("click", async (e) => {
      e.preventDefault();
      if (deleteStatus) deleteStatus.textContent = "";

      const confirmed = window.confirm("Are you sure you want to delete your account? This cannot be undone.");
      if (!confirmed) return;

      try {
        // Delete Firestore user doc first (optional but recommended)
        try {
          const userDocRef = window.firebaseDb.collection("users").doc(currentUser.uid);
          await userDocRef.delete();
        } catch (docErr) {
          console.warn("Error deleting user document:", docErr);
        }

        // Then delete Auth user
        await currentUser.delete();

        if (deleteStatus) deleteStatus.textContent = "Your account has been deleted.";
        // Redirect after a brief pause
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1500);
      } catch (err) {
        console.error("Error deleting account:", err);
        let msg = "Failed to delete your account. Please try again.";
        if (err.code === "auth/requires-recent-login") {
          msg = "For security, please log out and log back in, then try deleting your account again.";
        }
        if (deleteStatus) deleteStatus.textContent = msg;
      }
    });
  }
}

// ============================================================================
// PRESENCE TRACKING
// ============================================================================

// Update user's last seen timestamp
async function updatePresence() {
  if (!currentUser || !currentUserDoc) return;
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      lastSeen: getServerTimestamp()
    });
    console.log('Presence updated');
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

// Check if user is online (last seen < 5 minutes ago)
function isUserOnline(lastSeen) {
  if (!lastSeen) return false;
  
  const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const now = new Date();
  const diffMinutes = (now - lastSeenDate) / (1000 * 60);
  
  return diffMinutes < 5;
}

// Format last seen time
function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Never';
  
  const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const now = new Date();
  const diffMs = now - lastSeenDate;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return lastSeenDate.toLocaleDateString();
}

// ============================================================================
// INBOX PAGE
// ============================================================================

function initInboxPage() {
  initLogoutHandler();
  updateAuthUI();

  const authRequired = document.getElementById("auth-required");
  const inboxContent = document.getElementById("inbox-content");

  if (!currentUser || !currentUserDoc) {
    if (authRequired) authRequired.style.display = "block";
    if (inboxContent) inboxContent.style.display = "none";
    return;
  }

  if (authRequired) authRequired.style.display = "none";
  if (inboxContent) inboxContent.style.display = "block";

  // Update presence on page load
  updatePresence();
  
  // Update presence every 2 minutes
  setInterval(updatePresence, 2 * 60 * 1000);

  // Initialize tabs
  initInboxTabs();
  
  // Initialize compose modal
  initComposeModal();
  
  // Initialize conversations list
  initConversationsList();
  
  // Initialize friends functionality
  initFriendsTab();
}

// ============================================================================
// INBOX TABS
// ============================================================================

function initInboxTabs() {
  const tabButtons = document.querySelectorAll('.inbox-tab-btn');
  const tabContents = document.querySelectorAll('.inbox-tab-content');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      
      // Remove active class from all tabs
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      btn.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

// ============================================================================
// COMPOSE MODAL
// ============================================================================

function initComposeModal() {
  const newMessageButton = document.getElementById('new-message-button');
  const composeModal = document.getElementById('compose-modal');
  const closeComposeModal = document.getElementById('close-compose-modal');
  const composeForm = document.getElementById('inbox-compose-form');
  
  if (newMessageButton && composeModal) {
    newMessageButton.addEventListener('click', () => {
      composeModal.style.display = 'flex';
    });
  }
  
  if (closeComposeModal && composeModal) {
    closeComposeModal.addEventListener('click', () => {
      composeModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    composeModal.addEventListener('click', (e) => {
      if (e.target === composeModal) {
        composeModal.style.display = 'none';
      }
    });
  }
  
  // Compose form handler
  if (composeForm) {
    const newComposeForm = composeForm.cloneNode(true);
    composeForm.parentNode.replaceChild(newComposeForm, composeForm);
    
    newComposeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const statusDiv = document.getElementById('inbox-compose-status');
      const sendButton = document.getElementById('inbox-send-button');
      const toRecipient = document.getElementById('inbox-to-recipient').value.trim();
      const subject = document.getElementById('inbox-subject').value.trim();
      const body = document.getElementById('inbox-body').value.trim();
      const attachmentInput = document.getElementById('inbox-attachment');
      const attachmentFile = attachmentInput ? attachmentInput.files[0] : null;
      
      if (!toRecipient || !body) {
        statusDiv.textContent = 'Please provide recipient and message.';
        return;
      }
      
      try {
        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';
        statusDiv.textContent = '';
        
        // Look up recipient by username or email
        let recipientSnap;
        if (toRecipient.includes('@')) {
          recipientSnap = await db.collection('users').where('email', '==', toRecipient).limit(1).get();
        } else {
          recipientSnap = await db.collection('users').where('username', '==', toRecipient).limit(1).get();
        }
        
        if (recipientSnap.empty) {
          statusDiv.textContent = 'Recipient not found. Please check the username or email.';
          sendButton.disabled = false;
          sendButton.textContent = 'Send';
          return;
        }
        
        const recipientDoc = recipientSnap.docs[0];
        const recipientData = recipientDoc.data();
        const recipientUid = recipientDoc.id;
        
        let attachmentUrl = null;
        let attachmentPath = null;
        
        // Upload attachment if provided
        if (attachmentFile && storage) {
          const timestamp = Date.now();
          const fileName = `${timestamp}_${attachmentFile.name}`;
          const storagePath = `inboxAttachments/${currentUser.uid}/${fileName}`;
          const storageRef = storage.ref(storagePath);
          
          const snapshot = await storageRef.put(attachmentFile);
          attachmentUrl = await snapshot.ref.getDownloadURL();
          attachmentPath = storagePath;
        }
        
        // Create inbox message
        await db.collection('inboxMessages').add({
          fromUserId: currentUser.uid,
          fromEmail: currentUser.email || currentUserDoc.email || '',
          fromUsername: currentUserDoc.username || '',
          toUserId: recipientUid,
          toEmail: recipientData.email || '',
          toUsername: recipientData.username || '',
          subject: subject || null,
          body: body,
          attachmentUrl: attachmentUrl,
          attachmentPath: attachmentPath,
          participants: [currentUser.uid, recipientUid],
          readBy: [currentUser.uid],
          createdAt: getServerTimestamp(),
          updatedAt: getServerTimestamp()
        });
        
        statusDiv.textContent = 'Message sent successfully!';
        document.getElementById('inbox-to-recipient').value = '';
        document.getElementById('inbox-subject').value = '';
        document.getElementById('inbox-body').value = '';
        if (attachmentInput) attachmentInput.value = '';
        
        // Close modal after a delay
        setTimeout(() => {
          document.getElementById('compose-modal').style.display = 'none';
          statusDiv.textContent = '';
        }, 2000);
      } catch (error) {
        console.error('Error sending message:', error);
        statusDiv.textContent = 'Failed to send message. Please try again.';
      } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Send';
      }
    });
  }
}

// ============================================================================
// CONVERSATIONS LIST
// ============================================================================

function initConversationsList() {
  const conversationsList = document.getElementById('inbox-conversations-list');
  const conversationView = document.getElementById('conversation-view');
  const backButton = document.getElementById('back-to-conversations');
  
  if (!conversationsList || !currentUser) return;
  
  // Listen for messages
  db.collection('inboxMessages')
    .where('participants', 'array-contains', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        conversationsList.innerHTML = '<p class="no-content">No messages yet. Click "New Message" to start a conversation.</p>';
        return;
      }
      
      // Group messages by conversation
      const conversations = new Map();
      
      snapshot.docs.forEach(doc => {
        const msg = doc.data();
        const otherUserId = msg.fromUserId === currentUser.uid ? msg.toUserId : msg.fromUserId;
        
        if (!conversations.has(otherUserId)) {
          conversations.set(otherUserId, {
            userId: otherUserId,
            userName: msg.fromUserId === currentUser.uid ? 
              (msg.toUsername || msg.toEmail) : 
              (msg.fromUsername || msg.fromEmail),
            lastMessage: msg.body,
            lastMessageTime: msg.createdAt,
            messages: []
          });
        }
        
        conversations.get(otherUserId).messages.push({
          id: doc.id,
          ...msg
        });
      });
      
      // Render conversations
      conversationsList.innerHTML = '';
      conversations.forEach((conv, userId) => {
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.onclick = () => openConversation(userId, conv.userName, conv.messages);
        
        const time = conv.lastMessageTime?.toDate ? 
          conv.lastMessageTime.toDate().toLocaleString() : 
          'Unknown';
        
        div.innerHTML = `
          <div class="conversation-item-info">
            <div class="conversation-item-name">${conv.userName}</div>
            <div class="conversation-item-preview">${conv.lastMessage.substring(0, 100)}${conv.lastMessage.length > 100 ? '...' : ''}</div>
          </div>
          <div class="conversation-item-time">${time}</div>
        `;
        
        conversationsList.appendChild(div);
      });
    });
  
  // Back button handler
  if (backButton) {
    backButton.addEventListener('click', () => {
      conversationView.style.display = 'none';
      document.querySelector('.inbox-conversations').style.display = 'block';
    });
  }
}

function openConversation(userId, userName, messages) {
  const conversationView = document.getElementById('conversation-view');
  const conversationWith = document.getElementById('conversation-with');
  const conversationMessages = document.getElementById('conversation-messages');
  const conversationsSection = document.querySelector('.inbox-conversations');
  
  if (!conversationView) return;
  
  // Hide conversations list, show conversation view
  conversationsSection.style.display = 'none';
  conversationView.style.display = 'block';
  
  // Set conversation title
  conversationWith.textContent = `Conversation with ${userName}`;
  
  // Render messages
  messages.sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
    return aTime - bTime;
  });
  
  conversationMessages.innerHTML = messages.map(msg => {
    const isSent = msg.fromUserId === currentUser.uid;
    const time = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : 'Unknown';
    
    return `
      <div class="conversation-message ${isSent ? 'sent' : ''}">
        <div class="conversation-message-header">
          <span class="conversation-message-sender">${isSent ? 'You' : userName}</span>
          <span class="conversation-message-time">${time}</span>
        </div>
        ${msg.subject ? `<div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.3rem;">Re: ${msg.subject}</div>` : ''}
        <div class="conversation-message-body">${msg.body}</div>
        ${msg.attachmentUrl ? `<div style="margin-top: 0.5rem;"><img src="${msg.attachmentUrl}" alt="Attachment" style="max-width: 100%; border-radius: 4px; cursor: pointer;" onclick="window.open('${msg.attachmentUrl}', '_blank')"></div>` : ''}
      </div>
    `;
  }).join('');
  
  // Scroll to bottom
  conversationMessages.scrollTop = conversationMessages.scrollHeight;
  
  // Initialize reply form
  initReplyForm(userId, userName);
}

function initReplyForm(recipientUserId, recipientName) {
  const replyForm = document.getElementById('reply-form');
  
  if (!replyForm) return;
  
  const newReplyForm = replyForm.cloneNode(true);
  replyForm.parentNode.replaceChild(newReplyForm, replyForm);
  
  // Handle attachment file selection
  const attachmentInput = document.getElementById('reply-attachment');
  const attachmentName = document.getElementById('reply-attachment-name');
  
  if (attachmentInput && attachmentName) {
    attachmentInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        attachmentName.textContent = file.name;
      } else {
        attachmentName.textContent = '';
      }
    });
  }
  
  newReplyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const replyBody = document.getElementById('reply-body').value.trim();
    const attachmentFile = attachmentInput ? attachmentInput.files[0] : null;
    
    if (!replyBody && !attachmentFile) return;
    
    try {
      // Get recipient data
      const recipientDoc = await db.collection('users').doc(recipientUserId).get();
      const recipientData = recipientDoc.data();
      
      let attachmentUrl = null;
      let attachmentPath = null;
      
      // Upload attachment if provided
      if (attachmentFile && storage) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${attachmentFile.name}`;
        const storagePath = `inboxAttachments/${currentUser.uid}/${fileName}`;
        const storageRef = storage.ref(storagePath);
        
        const snapshot = await storageRef.put(attachmentFile);
        attachmentUrl = await snapshot.ref.getDownloadURL();
        attachmentPath = storagePath;
      }
      
      await db.collection('inboxMessages').add({
        fromUserId: currentUser.uid,
        fromEmail: currentUser.email || currentUserDoc.email || '',
        fromUsername: currentUserDoc.username || '',
        toUserId: recipientUserId,
        toEmail: recipientData.email || '',
        toUsername: recipientData.username || '',
        subject: null,
        body: replyBody || '',
        attachmentUrl: attachmentUrl,
        attachmentPath: attachmentPath,
        participants: [currentUser.uid, recipientUserId],
        readBy: [currentUser.uid],
        createdAt: getServerTimestamp(),
        updatedAt: getServerTimestamp()
      });
      
      document.getElementById('reply-body').value = '';
      if (attachmentInput) attachmentInput.value = '';
      if (attachmentName) attachmentName.textContent = '';
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    }
  });
}

// ============================================================================
// FRIENDS TAB
// ============================================================================

function initFriendsTab() {
  initAddFriendModal();
  loadFriends();
  loadFriendRequests();
  loadOutgoingRequests();
}

function initAddFriendModal() {
  const addFriendButton = document.getElementById('add-friend-button');
  const addFriendModal = document.getElementById('add-friend-modal');
  const closeAddFriendModal = document.getElementById('close-add-friend-modal');
  const addFriendForm = document.getElementById('add-friend-form');
  
  if (addFriendButton && addFriendModal) {
    addFriendButton.addEventListener('click', () => {
      addFriendModal.style.display = 'flex';
    });
  }
  
  if (closeAddFriendModal && addFriendModal) {
    closeAddFriendModal.addEventListener('click', () => {
      addFriendModal.style.display = 'none';
    });
    
    addFriendModal.addEventListener('click', (e) => {
      if (e.target === addFriendModal) {
        addFriendModal.style.display = 'none';
      }
    });
  }
  
  if (addFriendForm) {
    const newAddFriendForm = addFriendForm.cloneNode(true);
    addFriendForm.parentNode.replaceChild(newAddFriendForm, addFriendForm);
    
    newAddFriendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const statusDiv = document.getElementById('add-friend-status');
      const searchInput = document.getElementById('friend-search');
      const searchValue = searchInput.value.trim();
      
      if (!searchValue) {
        statusDiv.textContent = 'Please enter a username or email.';
        return;
      }
      
      try {
        statusDiv.textContent = 'Searching...';
        
        // Look up user by username or email
        let userSnap;
        if (searchValue.includes('@')) {
          userSnap = await db.collection('users').where('email', '==', searchValue).limit(1).get();
        } else {
          // Try usernameLower for case-insensitive search
          userSnap = await db.collection('users').where('usernameLower', '==', searchValue.toLowerCase()).limit(1).get();
          
          // Fallback to exact username match if usernameLower doesn't exist
          if (userSnap.empty) {
            userSnap = await db.collection('users').where('username', '==', searchValue).limit(1).get();
          }
        }
        
        if (userSnap.empty) {
          statusDiv.textContent = 'User not found. Please check the username or email.';
          return;
        }
        
        const friendDoc = userSnap.docs[0];
        const friendId = friendDoc.id;
        
        if (friendId === currentUser.uid) {
          statusDiv.textContent = 'You cannot add yourself as a friend.';
          return;
        }
        
        // Check if already friends
        const friendshipSnap = await db.collection('friendships')
          .where('users', 'array-contains', currentUser.uid)
          .get();
        
        const alreadyFriends = friendshipSnap.docs.some(doc => {
          const data = doc.data();
          return data.users.includes(friendId);
        });
        
        if (alreadyFriends) {
          statusDiv.textContent = 'You are already friends with this user.';
          return;
        }
        
        // Check if friend request already exists
        const requestSnap = await db.collection('friendRequests')
          .where('fromUserId', '==', currentUser.uid)
          .where('toUserId', '==', friendId)
          .where('status', '==', 'pending')
          .get();
        
        if (!requestSnap.empty) {
          statusDiv.textContent = 'Friend request already sent.';
          return;
        }
        
        // Create friend request
        await db.collection('friendRequests').add({
          fromUserId: currentUser.uid,
          fromUsername: currentUserDoc.username || currentUser.email,
          toUserId: friendId,
          toUsername: friendDoc.data().username || friendDoc.data().email,
          status: 'pending',
          createdAt: getServerTimestamp()
        });
        
        statusDiv.textContent = 'Friend request sent!';
        searchInput.value = '';
        
        setTimeout(() => {
          document.getElementById('add-friend-modal').style.display = 'none';
          statusDiv.textContent = '';
        }, 2000);
      } catch (error) {
        console.error('Error sending friend request:', error);
        statusDiv.textContent = 'Failed to send friend request. Please try again.';
      }
    });
  }
}

function loadFriends() {
  const friendsList = document.getElementById('friends-list');
  
  if (!friendsList || !currentUser) return;
  
  db.collection('friendships')
    .where('users', 'array-contains', currentUser.uid)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        friendsList.innerHTML = '<p class="no-content">No friends yet. Click "Add Friend" to connect with other users.</p>';
        return;
      }
      
      friendsList.innerHTML = '';
      
      snapshot.docs.forEach(async (doc) => {
        const data = doc.data();
        const friendId = data.users.find(id => id !== currentUser.uid);
        
        // Get friend data
        const friendDoc = await db.collection('users').doc(friendId).get();
        const friendData = friendDoc.data();
        
        const div = document.createElement('div');
        div.className = 'friend-item';
        
        const friendName = friendData.username || friendData.email || 'Unknown';
        const initial = friendName.charAt(0).toUpperCase();
        
        // Check online status using lastSeen
        const isOnline = isUserOnline(friendData.lastSeen);
        const statusText = isOnline ? 'Online' : formatLastSeen(friendData.lastSeen);
        
        // Build tier badge
        const tier = friendData.tier || 'starter';
        const tierBadge = `<span class="badge-tier-${tier}">${tier.toUpperCase()}</span>`;
        
        // Build role badge if admin
        const roleBadge = friendData.role === 'admin' ? '<span class="badge-role-admin">Admin</span>' : '';
        
        div.innerHTML = `
          <div class="friend-info">
            <div class="friend-avatar">${initial}</div>
            <div class="friend-details">
              <div class="friend-name">
                ${friendName}
                ${tierBadge}
                ${roleBadge}
              </div>
              <div class="friend-status">
                <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span>
                ${statusText}
              </div>
            </div>
          </div>
          <div class="friend-actions">
            <button class="btn-friend-message" onclick="window.messageUser('${friendId}', '${friendName}')">Message</button>
            <button class="btn-friend-remove" onclick="window.removeFriend('${doc.id}')">Remove</button>
          </div>
        `;
        
        friendsList.appendChild(div);
      });
    });
}

function loadFriendRequests() {
  const requestsList = document.getElementById('friend-requests-list');
  
  if (!requestsList || !currentUser) return;
  
  db.collection('friendRequests')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        requestsList.innerHTML = '<p class="no-content">No pending friend requests.</p>';
        return;
      }
      
      requestsList.innerHTML = '';
      
      snapshot.docs.forEach(async (doc) => {
        const data = doc.data();
        
        // Get requester data for tier and role
        const requesterDoc = await db.collection('users').doc(data.fromUserId).get();
        const requesterData = requesterDoc.data() || {};
        
        const div = document.createElement('div');
        div.className = 'friend-request-item';
        
        const initial = data.fromUsername.charAt(0).toUpperCase();
        
        // Build tier badge
        const tier = requesterData.tier || 'starter';
        const tierBadge = `<span class="badge-tier-${tier}">${tier.toUpperCase()}</span>`;
        
        // Build role badge if admin
        const roleBadge = requesterData.role === 'admin' ? '<span class="badge-role-admin">Admin</span>' : '';
        
        div.innerHTML = `
          <div class="friend-info">
            <div class="friend-avatar">${initial}</div>
            <div class="friend-details">
              <div class="friend-name">
                ${data.fromUsername}
                ${tierBadge}
                ${roleBadge}
              </div>
              <div class="friend-status">wants to be friends</div>
            </div>
          </div>
          <div class="friend-actions">
            <button class="btn-accept-friend" onclick="window.acceptFriendRequest('${doc.id}', '${data.fromUserId}')">Accept</button>
            <button class="btn-decline-friend" onclick="window.declineFriendRequest('${doc.id}')">Decline</button>
          </div>
        `;
        
        requestsList.appendChild(div);
      });
    });
}

function loadOutgoingRequests() {
  const outgoingList = document.getElementById('outgoing-requests-list');
  
  if (!outgoingList || !currentUser) return;
  
  db.collection('friendRequests')
    .where('fromUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        outgoingList.innerHTML = '<p class="no-content">No outgoing friend requests.</p>';
        return;
      }
      
      outgoingList.innerHTML = '';
      
      snapshot.docs.forEach(async (doc) => {
        const data = doc.data();
        
        // Get recipient data for tier and role
        const recipientDoc = await db.collection('users').doc(data.toUserId).get();
        const recipientData = recipientDoc.data() || {};
        
        const div = document.createElement('div');
        div.className = 'friend-request-item';
        
        const initial = data.toUsername.charAt(0).toUpperCase();
        
        // Build tier badge
        const tier = recipientData.tier || 'starter';
        const tierBadge = `<span class="badge-tier-${tier}">${tier.toUpperCase()}</span>`;
        
        // Build role badge if admin
        const roleBadge = recipientData.role === 'admin' ? '<span class="badge-role-admin">Admin</span>' : '';
        
        div.innerHTML = `
          <div class="friend-info">
            <div class="friend-avatar">${initial}</div>
            <div class="friend-details">
              <div class="friend-name">
                ${data.toUsername}
                ${tierBadge}
                ${roleBadge}
              </div>
              <div class="friend-status">
                <span style="color: var(--text-muted); font-size: 0.85rem;">Pending</span>
              </div>
            </div>
          </div>
          <div class="friend-actions">
            <button class="btn-decline-friend" onclick="window.cancelFriendRequest('${doc.id}')">Cancel</button>
          </div>
        `;
        
        outgoingList.appendChild(div);
      });
    });
}

// Global friend functions
window.messageUser = function(userId, userName) {
  // Switch to messages tab and open compose modal with user pre-filled
  document.querySelector('.inbox-tab-btn[data-tab="messages"]').click();
  document.getElementById('new-message-button').click();
  document.getElementById('inbox-to-recipient').value = userName;
};

window.removeFriend = async function(friendshipId) {
  if (!confirm('Are you sure you want to remove this friend?')) return;
  
  try {
    await db.collection('friendships').doc(friendshipId).delete();
  } catch (error) {
    console.error('Error removing friend:', error);
    alert('Failed to remove friend. Please try again.');
  }
};

window.acceptFriendRequest = async function(requestId, fromUserId) {
  try {
    // Create friendship
    await db.collection('friendships').add({
      users: [currentUser.uid, fromUserId],
      createdAt: getServerTimestamp()
    });
    
    // Update request status
    await db.collection('friendRequests').doc(requestId).update({
      status: 'accepted',
      respondedAt: getServerTimestamp(),
      updatedAt: getServerTimestamp()
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    alert('Failed to accept friend request. Please try again.');
  }
};

window.declineFriendRequest = async function(requestId) {
  try {
    await db.collection('friendRequests').doc(requestId).update({
      status: 'declined',
      respondedAt: getServerTimestamp(),
      updatedAt: getServerTimestamp()
    });
  } catch (error) {
    console.error('Error declining friend request:', error);
    alert('Failed to decline friend request. Please try again.');
  }
};

window.cancelFriendRequest = async function(requestId) {
  if (!confirm('Are you sure you want to cancel this friend request?')) return;
  
  try {
    await db.collection('friendRequests').doc(requestId).delete();
  } catch (error) {
    console.error('Error canceling friend request:', error);
    alert('Failed to cancel friend request. Please try again.');
  }
};

// ============================================================================
// ADMIN USER MANAGER
// ============================================================================

function initAdminUserManager() {
  const form = document.getElementById("admin-user-form");
  const statusDiv = document.getElementById("admin-user-status");
  const tempPwDisplay = document.getElementById("admin-user-temp-password-display");

  if (!form) {
    console.log("Admin user form not found - skipping initialization");
    return;
  }

  if (!functions) {
    console.error("Firebase Functions not available - admin user manager cannot work");
    if (statusDiv) {
      statusDiv.textContent = "Error: Firebase Functions not initialized. Check console.";
      statusDiv.style.display = "block";
    }
    return;
  }

  const uidInput = document.getElementById("admin-user-uid");
  const emailInput = document.getElementById("admin-user-email");
  const usernameInput = document.getElementById("admin-user-username");
  const roleSelect = document.getElementById("admin-user-role");
  const tierSelect = document.getElementById("admin-user-tier");
  const subscriptionEndsInput = document.getElementById("admin-user-subscription-ends");
  const mustChangeCheckbox = document.getElementById("admin-user-must-change-password");
  const tempPasswordInput = document.getElementById("admin-user-temp-password");
  const submitBtn = document.getElementById("admin-user-submit-button");

  const upsertFn = functions.httpsCallable("adminUpsertUser");

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Working..." : "Create / Update User";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (statusDiv) {
      statusDiv.textContent = "";
      statusDiv.style.display = "none";
    }
    if (tempPwDisplay) {
      tempPwDisplay.textContent = "";
      tempPwDisplay.style.display = "none";
    }

    const uid = uidInput && uidInput.value.trim() ? uidInput.value.trim() : undefined;
    const email = emailInput ? emailInput.value.trim() : "";
    const username = usernameInput ? usernameInput.value.trim() : "";
    const role = roleSelect ? roleSelect.value : "user";
    const tier = tierSelect ? tierSelect.value : "starter";
    const subscriptionEndsRaw = subscriptionEndsInput ? subscriptionEndsInput.value : "";
    const mustChangePassword = mustChangeCheckbox ? mustChangeCheckbox.checked : false;
    const tempPasswordRaw = tempPasswordInput ? tempPasswordInput.value.trim() : "";
    const tempPassword = tempPasswordRaw === "" ? null : tempPasswordRaw;

    if (!email) {
      if (statusDiv) {
        statusDiv.textContent = "Email is required.";
        statusDiv.className = "error-message";
        statusDiv.style.display = "block";
      }
      return;
    }

    if (!role || !tier) {
      if (statusDiv) {
        statusDiv.textContent = "Role and tier are required.";
        statusDiv.className = "error-message";
        statusDiv.style.display = "block";
      }
      return;
    }

    try {
      setLoading(true);

      const payload = {
        email,
        role,
        tier,
        username: username || null,
        mustChangePassword,
        tempPassword
      };

      // Add subscription end date if provided
      if (subscriptionEndsRaw) {
        // Convert datetime-local to timestamp (milliseconds)
        const subscriptionEndsDate = new Date(subscriptionEndsRaw);
        payload.subscriptionEndsAt = subscriptionEndsDate.getTime();
      }

      if (uid) {
        payload.uid = uid;
      }

      console.log("Calling adminUpsertUser with payload:", payload);
      const result = await upsertFn(payload);
      const data = result.data || {};

      console.log("adminUpsertUser result:", data);

      if (statusDiv) {
        statusDiv.className = "success-message";
        statusDiv.textContent = `User ${data.mode === "created" ? "created" : "updated"} successfully (uid: ${data.uid}).`;
        statusDiv.style.display = "block";
      }

      if (data.tempPassword && tempPwDisplay) {
        tempPwDisplay.innerHTML = `<strong>⚠️ Temporary password:</strong> <code style="font-size: 1.1em; padding: 0.2rem 0.5rem; background: rgba(0,0,0,0.3); border-radius: 3px;">${data.tempPassword}</code><br><small>Please save this password - it will not be shown again!</small>`;
        tempPwDisplay.style.display = "block";
      }

      // If we created a new user, populate the UID field
      if (!uid && uidInput && data.uid) {
        uidInput.value = data.uid;
      }

      // Reload the users list if we're on that tab
      const usersTab = document.getElementById("users-tab");
      if (usersTab && usersTab.classList.contains("active")) {
        loadUsers();
      }
    } catch (err) {
      console.error("adminUpsertUser error:", err);
      if (statusDiv) {
        const msg = err.message || "Failed to create/update user.";
        statusDiv.className = "error-message";
        statusDiv.textContent = `Error: ${msg}`;
        statusDiv.style.display = "block";
      }
    } finally {
      setLoading(false);
    }
  });

  console.log("Admin User Manager initialized");
}

// ============================================================================
// ADMIN PAGE
// ============================================================================

function initAdminPage() {
  initLogoutHandler();
  updateAuthUI();
  console.log("Admin page initialized. Admin user:", currentUser, currentUserDoc);
  // Admin page has its own inline script for now
  // Initialize admin user manager if on admin page
  initAdminUserManager();
  // Initialize admin slip requests
  initAdminSlipRequests();
}

// ============================================================================
// ADMIN SLIP REQUESTS
// ============================================================================

function initAdminSlipRequests() {
  const list = document.getElementById("admin-slip-requests-list");
  if (!list || !currentUser || !currentUserDoc || currentUserDoc.role !== "admin") {
    return;
  }

  db.collection("slipRequests")
    .orderBy("createdAt", "desc")
    .limit(100)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        list.innerHTML = '<p class="no-content">No slip requests yet.</p>';
        return;
      }

      list.innerHTML = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;

        const card = document.createElement("div");
        card.className = "admin-slip-request-card";

        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleString()
          : "";

        const status = data.status || "pending";
        
        // Prefer username over email when displaying requester
        const requesterDisplay = data.username || data.userEmail || "Unknown";

        card.innerHTML = `
          <div class="admin-slip-request-meta">
            <div><strong>${requesterDisplay}</strong> (${data.tier || ""})</div>
            <div>Sport: ${data.sport || ""}</div>
            <div>Created: ${createdAt}</div>
            <div>Status: <span class="status-${status}">${status}</span></div>
          </div>
          <p class="admin-slip-request-text">${data.requestText || ""}</p>
          <div class="admin-slip-request-actions">
            ${
              status === "pending"
                ? `
                  <textarea class="admin-slip-response-input" data-id="${id}"
                    placeholder="Type your slip or response to send to this user"></textarea>
                  <div style="margin: 0.5rem 0;">
                    <label for="admin-slip-attachment-${id}" class="btn btn-outline btn-sm">📎 Attach Image</label>
                    <input type="file" id="admin-slip-attachment-${id}" class="admin-slip-attachment" data-id="${id}" accept="image/*" style="display: none;">
                    <span class="admin-slip-attachment-name" data-id="${id}" style="margin-left: 0.5rem; font-size: 0.9rem; color: var(--text-muted);"></span>
                  </div>
                  <button class="admin-slip-accept btn btn-primary" data-id="${id}">Accept & Send</button>
                  <button class="admin-slip-reject btn btn-outline" data-id="${id}">Reject</button>
                `
                : data.responseSlip || data.responseAttachmentUrl
                ? `
                  <p><strong>Response:</strong> ${data.responseSlip || ""}</p>
                  ${data.responseAttachmentUrl ? `<div style="margin-top: 0.5rem;"><img src="${data.responseAttachmentUrl}" alt="Response attachment" style="max-width: 100%; border-radius: 4px; cursor: pointer;" onclick="window.open('${data.responseAttachmentUrl}', '_blank')"></div>` : ''}
                `
                : ""
            }
          </div>
        `;

        list.appendChild(card);
      });

      attachSlipRequestHandlers();
    });
}

function attachSlipRequestHandlers() {
  // Handle file selection for attachments
  document.querySelectorAll(".admin-slip-attachment").forEach((input) => {
    input.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-id");
      const nameSpan = document.querySelector(`.admin-slip-attachment-name[data-id="${id}"]`);
      const file = e.target.files[0];
      if (file && nameSpan) {
        nameSpan.textContent = file.name;
      } else if (nameSpan) {
        nameSpan.textContent = '';
      }
    });
  });

  // Accept buttons
  document.querySelectorAll(".admin-slip-accept").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      const textarea = document.querySelector(`.admin-slip-response-input[data-id="${id}"]`);
      const attachmentInput = document.querySelector(`.admin-slip-attachment[data-id="${id}"]`);
      
      if (!textarea) return;
      
      const responseSlip = textarea.value.trim();
      const attachmentFile = attachmentInput ? attachmentInput.files[0] : null;
      
      if (!responseSlip && !attachmentFile) {
        alert("Please enter a response slip or attach an image.");
        return;
      }

      try {
        btn.disabled = true;
        btn.textContent = "Processing...";

        // Get the request data
        const requestDoc = await db.collection("slipRequests").doc(id).get();
        const requestData = requestDoc.data();

        let attachmentUrl = null;
        let attachmentPath = null;

        // Upload attachment if provided
        if (attachmentFile && storage) {
          const timestamp = Date.now();
          const fileName = `${timestamp}_${attachmentFile.name}`;
          const storagePath = `slipResponses/${currentUser.uid}/${fileName}`;
          const storageRef = storage.ref(storagePath);
          
          const snapshot = await storageRef.put(attachmentFile);
          attachmentUrl = await snapshot.ref.getDownloadURL();
          attachmentPath = storagePath;
        }

        // Update the slip request
        await db.collection("slipRequests").doc(id).update({
          status: "accepted",
          responseSlip: responseSlip,
          responseAttachmentUrl: attachmentUrl,
          responseAttachmentPath: attachmentPath,
          updatedAt: getServerTimestamp()
        });

        // Get recipient user data to get username
        const recipientDoc = await db.collection("users").doc(requestData.userId).get();
        const recipientData = recipientDoc.exists ? recipientDoc.data() : {};
        
        // Create an inbox message to the user
        await db.collection("inboxMessages").add({
          fromUserId: currentUser.uid,
          fromEmail: currentUser.email || currentUserDoc.email || "",
          fromUsername: currentUserDoc.username || "",
          toUserId: requestData.userId,
          toEmail: requestData.userEmail || "",
          toUsername: recipientData.username || "",
          subject: `Slip request response (${requestData.sport || ""})`,
          body: responseSlip,
          attachmentUrl: attachmentUrl,
          attachmentPath: attachmentPath,
          participants: [currentUser.uid, requestData.userId],
          readBy: [currentUser.uid],
          createdAt: getServerTimestamp(),
          updatedAt: getServerTimestamp()
        });

        alert("Slip request accepted and response sent to user's inbox.");
      } catch (error) {
        console.error("Error accepting slip request:", error);
        alert("Failed to accept slip request. Please try again.");
        btn.disabled = false;
        btn.textContent = "Accept & Send";
      }
    });
  });

  // Reject buttons
  document.querySelectorAll(".admin-slip-reject").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      
      if (!confirm("Are you sure you want to reject this slip request?")) {
        return;
      }

      try {
        btn.disabled = true;
        btn.textContent = "Processing...";

        await db.collection("slipRequests").doc(id).update({
          status: "rejected",
          updatedAt: getServerTimestamp()
        });

        alert("Slip request rejected.");
      } catch (error) {
        console.error("Error rejecting slip request:", error);
        alert("Failed to reject slip request. Please try again.");
        btn.disabled = false;
        btn.textContent = "Reject";
      }
    });
  });
}

// ============================================================================
// PUBLIC PAGE
// ============================================================================

function initPublicPage(page) {
  updateAuthUI();
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

async function uploadChatImage(file) {
  try {
    if (!currentUser) {
      throw new Error('Must be logged in to upload images');
    }
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storagePath = `chatImages/${currentUser.uid}/${fileName}`;
    const storageRef = storage.ref(storagePath);

    console.log('Uploading chat image:', fileName);
    const snapshot = await storageRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();

    console.log('Chat image uploaded successfully:', downloadURL);
    return {
      url: downloadURL,
      path: storagePath,
      name: fileName,
      type: file.type,
      size: file.size
    };
  } catch (error) {
    console.error('Error uploading chat image:', error);
    throw error;
  }
}

async function deleteChatMessage(messageId) {
  try {
    // Get the message first to check if it has an image
    const messageDoc = await db.collection('chat').doc(messageId).get();
    
    if (messageDoc.exists) {
      const messageData = messageDoc.data();
      
      // Delete the image from storage if it exists
      if (messageData.imagePath) {
        try {
          const storageRef = storage.ref(messageData.imagePath);
          await storageRef.delete();
          console.log('Chat image deleted from storage:', messageData.imagePath);
        } catch (storageError) {
          console.warn('Could not delete image from storage:', storageError);
          // Continue with message deletion even if image deletion fails
        }
      } else if (messageData.imageUrl) {
        // Fallback to trying to delete by URL for old messages
        try {
          const storageRef = storage.refFromURL(messageData.imageUrl);
          await storageRef.delete();
          console.log('Chat image deleted from storage:', messageData.imageUrl);
        } catch (storageError) {
          console.warn('Could not delete image from storage:', storageError);
        }
      }
      
      // Delete the message document
      await db.collection('chat').doc(messageId).delete();
      console.log('Chat message deleted:', messageId);
    }
  } catch (error) {
    console.error('Error deleting chat message:', error);
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

// Wrapper function for delete that can be called from onclick
window.deleteChatMessageById = async function(messageId) {
  // Get message to check ownership
  const messageDoc = await db.collection('chat').doc(messageId).get();
  if (!messageDoc.exists) {
    alert('Message not found.');
    return;
  }
  
  const messageData = messageDoc.data();
  const isOwn = messageData.userId === currentUser.uid;
  const isAdmin = currentUserDoc && currentUserDoc.role === 'admin';
  
  if (!isAdmin && !isOwn) {
    alert('You can only delete your own messages.');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this message?')) {
    return;
  }
  
  try {
    await deleteChatMessage(messageId);
    console.log('Message deleted successfully');
  } catch (error) {
    console.error('Error deleting message:', error);
    alert('Failed to delete message. Please try again.');
  }
};

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
window.uploadChatImage = uploadChatImage;
window.deleteChatMessage = deleteChatMessage;
window.sendChatMessage = sendChatMessage;
window.onChatMessages = onChatMessages;
window.stopChatListener = stopChatListener;
window.isAdmin = isAdmin;
window.hasChatAccess = hasChatAccess;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.initAdminUserManager = initAdminUserManager;

console.log('$lip$mith Application initialized with unified auth flow');

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

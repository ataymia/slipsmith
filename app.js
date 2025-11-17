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

    if (page === "portal" || page === "admin" || page === "account") {
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
  const imageButton = document.getElementById("chat-image-button");
  const imageInput = document.getElementById("chat-image-input");
  const imagePreview = document.getElementById("chat-image-preview");
  const previewImg = document.getElementById("chat-preview-img");
  const removeImageBtn = document.getElementById("chat-remove-image");

  if (!messagesContainer || !chatForm || !chatInput) return;

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
      const imageHtml = msg.imageUrl ? `
        <div class="message-image">
          <img src="${msg.imageUrl}" alt="Shared image" onclick="window.open('${msg.imageUrl}', '_blank')">
        </div>
      ` : '';
      
      const deleteBtn = isAdmin ? `
        <button class="btn-delete-message" onclick="window.deleteChatMessageById('${msg.id}')">Delete</button>
      ` : '';
      
      return `
        <div class="chat-message ${isOwn ? 'own-message' : ''}" data-message-id="${msg.id}">
          <div class="message-header">
            <span class="message-user">${msg.userName || 'Anonymous'}</span>
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
  const newChatForm = chatForm.cloneNode(true);
  chatForm.parentNode.replaceChild(newChatForm, chatForm);

  newChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById("chat-input").value.trim();
    
    // Allow sending if there's text or an image
    if (!text && !selectedImage) return;

    try {
      const userName = currentUserDoc.username || currentUser.email.split('@')[0];
      const messageData = {
        text: text || '',
        userId: currentUser.uid,
        userName: userName,
        timestamp: Date.now()
      };

      // Upload image if selected
      if (selectedImage) {
        const uploadResult = await uploadChatImage(selectedImage);
        messageData.imageUrl = uploadResult.url;
      }

      await sendChatMessage(messageData);
      
      // Clear input and image
      document.getElementById("chat-input").value = '';
      selectedImage = null;
      document.getElementById("chat-image-input").value = '';
      document.getElementById("chat-image-preview").style.display = 'none';
      document.getElementById("chat-preview-img").src = '';
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
  const usernameSaveButton = document.getElementById("account-username-save-button");
  const usernameStatus = document.getElementById("account-username-status");

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

  // 3) Username change handler
  if (usernameSaveButton && usernameInput) {
    usernameSaveButton.addEventListener("click", async (e) => {
      e.preventDefault();
      if (usernameStatus) usernameStatus.textContent = "";

      const newUsername = usernameInput.value.trim();
      if (!newUsername) {
        if (usernameStatus) usernameStatus.textContent = "Username cannot be empty.";
        return;
      }

      try {
        const userDocRef = window.firebaseDb.collection("users").doc(currentUser.uid);
        await userDocRef.update({
          username: newUsername,
          updatedAt: getServerTimestamp()
        });

        currentUserDoc.username = newUsername;
        if (usernameStatus) usernameStatus.textContent = "Username updated successfully.";
      } catch (err) {
        console.error("Error updating username:", err);
        if (usernameStatus) usernameStatus.textContent = "Failed to update username. Please try again.";
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

      if (uid) {
        payload.uid = uid;
      }

      console.log("Calling adminUpsertUser with payload:", payload);
      const result = await upsertFn(payload);
      const data = result.data || {};

      console.log("adminUpsertUser result:", data);

      // Update subscriptionEndsAt directly in Firestore if provided
      if (subscriptionEndsRaw && data.uid) {
        try {
          const subscriptionEndsDate = new Date(subscriptionEndsRaw);
          await db.collection("users").doc(data.uid).update({
            subscriptionEndsAt: firebase.firestore.Timestamp.fromDate(subscriptionEndsDate),
            updatedAt: getServerTimestamp()
          });
          console.log("Subscription end date updated:", subscriptionEndsDate);
        } catch (subErr) {
          console.error("Error updating subscription end date:", subErr);
          if (statusDiv) {
            statusDiv.textContent += " (Warning: Could not set subscription end date)";
          }
        }
      }

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
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = storage.ref(`chat/${fileName}`);

    console.log('Uploading chat image:', fileName);
    const snapshot = await storageRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();

    console.log('Chat image uploaded successfully:', downloadURL);
    return {
      url: downloadURL,
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
      if (messageData.imageUrl) {
        try {
          const storageRef = storage.refFromURL(messageData.imageUrl);
          await storageRef.delete();
          console.log('Chat image deleted from storage:', messageData.imageUrl);
        } catch (storageError) {
          console.warn('Could not delete image from storage:', storageError);
          // Continue with message deletion even if image deletion fails
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
  if (!currentUserDoc || currentUserDoc.role !== 'admin') {
    alert('Only admins can delete messages.');
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

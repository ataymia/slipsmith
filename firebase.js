// firebase.js
// Centralized Firebase initialization for $lip$mith using v9 compat CDN SDKs.

// IMPORTANT:
// Each HTML page that uses Firebase MUST include these scripts BEFORE this file:
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB4vdahYFd4skauh01_ZxnPgw8BxrnoWcw",
  authDomain: "slip-smith.firebaseapp.com",
  projectId: "slip-smith",
  storageBucket: "slip-smith.firebasestorage.app",
  messagingSenderId: "179847052522",
  appId: "1:179847052522:web:228267b4e72df759666b93"
};

// Initialize Firebase using the global 'firebase' (compat) object
if (!firebase.apps || firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Expose services globally so other scripts (like app.js) can use them
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;

// Optional console log for sanity check
console.log("Firebase initialized for $lip$mith:", firebase.app().name);

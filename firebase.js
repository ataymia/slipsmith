// Firebase Configuration and Initialization
// Replace these with your actual Firebase project credentials

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
// Uncomment the following lines when you have added the Firebase SDK scripts
/*
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Export for use in app.js
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
*/

// Placeholder initialization for development
console.log('Firebase configuration loaded. Please add Firebase SDK scripts and uncomment initialization code.');

// Development mode - mock Firebase services
if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded. Running in mock mode.');
    
    // Mock authentication
    window.firebaseAuth = {
        currentUser: null,
        signInWithEmailAndPassword: async (email, password) => {
            console.log('Mock login:', email);
            return { user: { uid: 'mock-uid', email } };
        },
        signOut: async () => {
            console.log('Mock logout');
        },
        sendPasswordResetEmail: async (email) => {
            console.log('Mock password reset:', email);
        },
        onAuthStateChanged: (callback) => {
            console.log('Mock auth state observer attached');
            // Simulate no user logged in initially
            setTimeout(() => callback(null), 100);
        }
    };
    
    // Mock Firestore
    window.firebaseDb = {
        collection: (name) => ({
            doc: (id) => ({
                get: async () => ({ exists: false, data: () => null }),
                set: async () => console.log('Mock set:', name, id),
                update: async () => console.log('Mock update:', name, id),
                delete: async () => console.log('Mock delete:', name, id)
            }),
            where: () => ({
                get: async () => ({ docs: [] })
            }),
            orderBy: () => ({
                onSnapshot: (callback) => {
                    console.log('Mock snapshot listener:', name);
                    callback({ docs: [] });
                },
                get: async () => ({ docs: [] })
            }),
            add: async (data) => {
                console.log('Mock add:', name, data);
                return { id: 'mock-doc-id' };
            },
            get: async () => ({ docs: [] })
        })
    };
    
    // Mock Storage
    window.firebaseStorage = {
        ref: (path) => ({
            put: async (file) => {
                console.log('Mock upload:', path, file.name);
                return {
                    ref: {
                        getDownloadURL: async () => `mock-url-${file.name}`
                    }
                };
            }
        })
    };
}

// Instructions for setting up Firebase:
console.log(`
╔════════════════════════════════════════════════════════════╗
║                   FIREBASE SETUP REQUIRED                  ║
╚════════════════════════════════════════════════════════════╝

To enable full functionality, please:

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Create a Firestore Database
4. Enable Storage
5. Add your Firebase config above
6. Include Firebase SDK in your HTML files:

   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-storage.js"></script>

7. Uncomment the initialization code in this file

Current Status: Running in MOCK MODE for development/testing
`);

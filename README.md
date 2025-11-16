# $lip$mith

A premium content platform with tiered subscriptions, built with HTML/CSS/JS and Firebase.

## 🎯 Overview

$lip$mith is a static site that provides tiered content access with real-time chat for premium members. The platform uses Firebase for authentication, database, and storage.

## ✨ Features

- **Tiered Subscriptions**: Starter, Pro, and VIP membership levels
- **Content Management**: Admin dashboard for creating and managing posts
- **Tier-Based Access**: Content visibility based on subscription level
- **Real-Time Chat**: Live chat for Pro and VIP members
- **User Management**: Admin tools for managing user tiers
- **Secure Authentication**: Firebase-powered login system
- **File Uploads**: Support for images, videos, and documents
- **Dark Theme**: Modern dark interface with money green accents

## 📁 Project Structure

```
slipsmith/
├── index.html          # Landing page (What We Do)
├── plans.html          # Subscription plans and payment info
├── login.html          # User authentication
├── portal.html         # Member portal with content feed and chat
├── admin.html          # Admin dashboard
├── styles.css          # Dark theme with money green styling
├── firebase.js         # Firebase configuration and initialization
├── app.js              # Core application logic
└── README.md           # This file
```

## 🚀 Getting Started

### Prerequisites

- A Firebase project (free tier is sufficient)
- A web browser
- (Optional) A local web server for development

### Firebase Setup

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project

2. **Enable Authentication**
   - Navigate to Authentication > Sign-in method
   - Enable Email/Password authentication

3. **Create Firestore Database**
   - Navigate to Firestore Database
   - Create database in test mode (or production mode with security rules)

4. **Enable Storage**
   - Navigate to Storage
   - Get started with default settings

5. **Get Your Config**
   - Go to Project Settings > General
   - Scroll to "Your apps" and select the web app (</>) option
   - Copy the Firebase configuration

6. **Update firebase.js**
   - Replace the placeholder config in `firebase.js` with your actual Firebase config
   - Uncomment the initialization code

7. **Add Firebase SDK to HTML files**
   
   Add these script tags before the closing `</body>` tag in your HTML files (before firebase.js):
   
   ```html
   <!-- Firebase App (the core Firebase SDK) -->
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js"></script>
   
   <!-- Firebase Auth -->
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth-compat.js"></script>
   
   <!-- Firebase Firestore -->
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore-compat.js"></script>
   
   <!-- Firebase Storage -->
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-storage-compat.js"></script>
   ```
   
   Replace `9.x.x` with the latest version number.

### Running Locally

1. **Simple HTTP Server**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server
   ```

2. **Open in Browser**
   - Navigate to `http://localhost:8000`

### Creating an Admin User

Since this is a static site, you'll need to manually create the first admin user:

1. Create a user through Firebase Console (Authentication section)
2. Add a document in Firestore:
   - Collection: `users`
   - Document ID: (the user's UID from Authentication)
   - Fields:
     ```
     {
       "email": "admin@example.com",
       "role": "admin",
       "tier": "vip",
       "createdAt": (timestamp),
       "updatedAt": (timestamp)
     }
     ```

## 💳 Payment Methods

The platform displays payment information for:
- **PayPal**: @yatadagoat
- **Cash App**: $yatadagoat
- **Venmo**: @yatadagoat
- **Chime**: $yatadagoat

These payment details can be updated in `plans.html` if needed.

## 📊 Subscription Tiers

### Starter - $9.99/month
- Basic content access
- Community posts
- Monthly updates

### Pro - $24.99/month
- All Starter features
- Premium content access
- Real-time chat
- Weekly updates
- Priority support

### VIP - $49.99/month
- All Pro features
- VIP exclusive content
- Daily updates
- Direct messaging
- Early access
- Special perks

## 🎨 Theme

The site uses a dark theme with money green (#00ff88) as the primary accent color, creating a premium, modern aesthetic.

## 🔒 Security Notes

1. **Firestore Security Rules**: Implement proper security rules in production:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && 
                        (request.auth.uid == userId || 
                         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
       }
       
       match /posts/{postId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && 
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
       }
       
       match /chat/{messageId} {
         allow read: if request.auth != null && 
                       (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tier == 'pro' ||
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tier == 'vip');
         allow create: if request.auth != null && 
                         request.resource.data.userId == request.auth.uid;
       }
     }
   }
   ```

2. **Storage Rules**: Implement storage security rules
3. **Environment Variables**: Never commit Firebase config with sensitive data to public repositories

## 📝 License

This project is for private use.

## 🤝 Support

For issues or questions, please contact the administrator.
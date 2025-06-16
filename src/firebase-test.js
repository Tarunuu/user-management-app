// firebase-test.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://nodejs-user-management-87fec.firebaseio.com"
});

// Get database reference
const db = admin.database();
const usersRef = db.ref('users');

// Test connection
usersRef.once('value')
  .then(() => console.log('Firebase connection successful! Data:', snapshot.val()))
  .catch(err => console.error('Firebase connection failed:', err));
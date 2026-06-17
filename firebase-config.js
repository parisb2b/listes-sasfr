// LISTES — Configuration Firebase
// Projet : sasfr-chantiers (partagé avec Chantier Tracker, collections séparées)
// Encodage UTF-8 — Ne pas modifier sans audit

var fbConfig = {
  apiKey: "AIzaSyDuMelJjjPWDnJOj8_rnehddcQxRMWr058",
  authDomain: "sasfr-chantiers.firebaseapp.com",
  projectId: "sasfr-chantiers",
  storageBucket: "sasfr-chantiers.appspot.com"
};

firebase.initializeApp(fbConfig);

var db = firebase.firestore();
var auth = firebase.auth();
var listsRef = db.collection('listes_lists');
var usersRef = db.collection('users');

// Email admin bootstrap — premier compte créé avec cet email sera admin=true
var MASTER_EMAIL = 'parisb2b@gmail.com';

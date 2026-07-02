import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyB25rtI2AYoyg3pTsdGj7ni8Hy866Mma7o",
  authDomain: "cumulative-record.firebaseapp.com",
  projectId: "cumulative-record",
  storageBucket: "cumulative-record.firebasestorage.app",
  messagingSenderId: "345967778434",
  appId: "1:345967778434:web:8feb05e345ad1fd222b29b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

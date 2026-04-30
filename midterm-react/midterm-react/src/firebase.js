import {initializeApp} from "firebase/app"
import {getAuth} from "firebase/auth"
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAdJnY5XjokhsokDHy4Fn9Dz4P5C18aYho",
  authDomain: "midterm-aa30c.firebaseapp.com",
  projectId: "midterm-aa30c",
  storageBucket: "midterm-aa30c.firebasestorage.app",
  messagingSenderId: "910194978337",
  appId: "1:910194978337:web:c7913338db64a111febd60",
  measurementId: "G-HQHMPC6GFJ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
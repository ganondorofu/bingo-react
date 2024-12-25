// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebaseの設定情報
const firebaseConfig = {
  apiKey: "AIzaSyApPSMnhvVLc5Q6HuaeI2JoJSdIMIrL22g",
  authDomain: "bingo-2eca7.firebaseapp.com",
  projectId: "bingo-2eca7",
  storageBucket: "bingo-2eca7.firebasestorage.app",
  messagingSenderId: "721215492031",
  appId: "1:721215492031:web:e8d0d37653e99665779b0a",
  measurementId: "G-LQCFYRKC9V"
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// Firestoreのインスタンスを取得
const db = getFirestore(app);

export { db };

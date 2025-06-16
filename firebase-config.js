// firebase-config.js

// Firebaseのライブラリから必要な関数をインポート
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAGllMEcfBpFlaPVvbaQr0sTJ17_hA4BI0",
  authDomain: "lab-entry-41a1d.firebaseapp.com",
  projectId: "lab-entry-41a1d",
  storageBucket: "lab-entry-41a1d.firebasestorage.app",
  messagingSenderId: "626761347970",
  appId: "1:626761347970:web:4f1a3b4ba54f904d6b959b",
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firestoreデータベースへの参照を取得し、他のファイルで使えるようにエクスポート
export const db = getFirestore(app);
export const auth = getAuth(app);
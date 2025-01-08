import * as admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config(); // .env 파일 로드

// Firebase 초기화
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"), // 줄바꿈 처리
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: "https://yeonpick-quokka.firebaseio.com", // Firebase Database URL
});

// Firestore 인스턴스 가져오기
const db = admin.firestore();

export default db; // TypeScript에서 모듈 내보내기

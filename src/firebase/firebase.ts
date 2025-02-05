import * as admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    databaseURL: "https://yeonpick-quokka.firebaseio.com",
  });
}

// Firestore 인스턴스 가져오기
const db = admin.firestore();

// 🔥 캐시 비활성화 설정 추가
db.settings({
  ignoreUndefinedProperties: true,
  timestampsInSnapshots: true, // Firestore에서 Timestamp를 Date 객체로 변환
});

export default db;
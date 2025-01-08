const admin = require("firebase-admin");
const dotenv = require("dotenv");
dotenv.config(); // .env 파일 로드

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // 줄바꿈 처리
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: "https://yeonpick-quokka.firebaseio.com", // Firebase Database URL
});

const db = admin.firestore(); // Firestore 연결
module.exports = db;
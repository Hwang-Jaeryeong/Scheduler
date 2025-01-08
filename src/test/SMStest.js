const db = require("../firebase/firebase"); // firebase.js 가져오기
const coolsms = require('coolsms-node-sdk').default;
const dotenv = require("dotenv");
dotenv.config(); // .env 파일 로드

// CoolSMS API 인스턴스 초기화
const messageService = new coolsms(process.env.COOLSMS_API_KEY, process.env.COOLSMS_API_SECRET);

// 문자 전송 함수
async function sendSMS(phone, message) {
  try {
    const response = await messageService.sendOne({
      to: phone,                 // 수신자 번호
      from: process.env.SENDER_PHONE, // 발신 번호 (CoolSMS에 등록된 번호)
      text: message,             // 문자 내용
    });
    console.log(`SMS 발송 성공: ${response.messageId}`);
  } catch (error) {
    console.error(`SMS 발송 실패: ${error.message}`);
  }
}

// Firebase에서 첫 번째 사용자 데이터 가져와 SMS 전송
async function fetchFirstUserAndSendSMS() {
  try {
    // Firestore에서 user 컬렉션에서 첫 번째 데이터 가져오기
    // 여기에 <가입 완료> 조건으로 나중에 바꾸기
    const snapshot = await db.collection("user").limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const user = doc.data(); // 데이터 가져오기
      const name = user.userName; // userName 필드
      const phone = process.env.SENDER_PHONE; // 테스트용 고정 번호
      // const phone = user.userPhone; // 실제 Firebase 데이터의 전화번호

      const message = `${name}님, 연픽에 가입하신 것을 환영합니다!`;
      console.log(`Sending SMS to ${phone}: ${message}`);
      await sendSMS(phone, message);
    } else {
      console.log("Firestore에 사용자 데이터가 없습니다.");
    }
  } catch (error) {
    console.error("Firebase 쿼리 중 오류 발생:", error);
  }
}

// 실행
fetchFirstUserAndSendSMS();
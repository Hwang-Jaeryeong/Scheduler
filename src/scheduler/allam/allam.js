const cron = require("node-cron");
const db = require("../../firebase/firebase"); // Firebase 초기화

// 신규 가입자 처리: 가입 및 설문 완료 시 즉시 전송
async function handleNewSignups() {
  try {
    const snapshot = await db
      .collection("user")
      .where("userType", "==", "all") // 설문 완료
      .limit(2)
      .get();

    snapshot.forEach(async (doc) => {
      const user = doc.data();
      const phone = user.userPhone;
      const name = user.userName;

      // 즉시 메시지 전송
      console.log(`[신규 가입자] ${name} (${phone}): 환영 메시지 전송`);
      await sendSMS(phone, `환영합니다, ${name}님! 연픽에 오신 것을 축하드립니다.`);
    });
  } catch (error) {
    console.error("Firebase 쿼리 중 오류 발생 (신규 가입자):", error);
  }
}

// 신규 미설문자 처리: 매주 월요일에 전송
async function handleNewIncompleteSurveys() {
  try {
    const snapshot = await db
      .collection("user")
      .where("userType", "!=", null) // 가입 완료
      .where("datingSelfArea", "==", null) // 설문 미완료
      .get();

    snapshot.forEach(async (doc) => {
      const user = doc.data();
      const phone = user.userPhone;
      const name = user.userName;

      // 설문 미완료 메시지 전송
      console.log(`[미설문자] ${name} (${phone}): 설문 완료 요청 메시지 전송`);
      await sendSMS(phone, `안녕하세요 ${name}님, 설문을 완료해 주세요!`);
    });
  } catch (error) {
    console.error("Firebase 쿼리 중 오류 발생 (미설문자):", error);
  }
}

// 문자 전송 함수 (터미널에서 출력용)
async function sendSMS(phone, message) {
  console.log(`Sending SMS to ${phone}: ${message}`);
  // 실제 카카오톡/문자 API 연동은 여기에 추가
}

// 스케줄러 설정 (매주 수요일 10:15)
cron.schedule("15 10 * * 3", async () => {
  // 매주 월요일 00:00에 실행
  console.log("[스케줄러] 01/08 테스트: 신규 미설문자 처리 시작");
  await handleNewIncompleteSurveys();
  console.log("[스케줄러] 신규 미설문자 처리 완료");
});

// 테스트 실행
(async () => {
  console.log("[테스트] 신규 가입자 처리 시작");
  await handleNewSignups();
  console.log("[테스트] 신규 가입자 처리 완료");
})();


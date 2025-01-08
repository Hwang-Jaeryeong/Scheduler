const db = require("../../firebase/firebase"); // firebase.js 가져오기
const coolsms = require("coolsms-node-sdk").default;
const dotenv = require("dotenv");
dotenv.config(); // .env 파일 로드

// CoolSMS API 인스턴스 초기화
const messageService = new coolsms(process.env.COOLSMS_API_KEY, process.env.COOLSMS_API_SECRET);

// 문자 전송 함수
async function sendSMS(phone, message) {
  try {
    const response = await messageService.sendOne({
      to: phone, // 수신자 번호
      from: process.env.SENDER_PHONE, // 발신 번호
      text: message, // 문자 내용
    });
    console.log(`SMS 발송 성공: ${response.messageId}`);
  } catch (error) {
    console.error(`SMS 발송 실패: ${error.message}`);
  }
}

async function handleNewIncompleteSurveys() {
  try {
    const snapshot = await db
      .collection("user")
      .where("dating.datingGroup", "==", "D")
      .where("meeting.meetingGroup", "==", "D")
      .get();

    if (snapshot.empty) {
      console.log("미설문자 대상자가 없습니다.");
      return;
    }

    console.log(`[${snapshot.size}명] 미설문자 대상자 확인 완료`);

    let firstUserProcessed = false; // 첫 번째 사용자에게만 실제 문자 전송

    snapshot.forEach(async (doc) => {
      const user = doc.data();
      const name = user.userName;
      const phone = process.env.SENDER_PHONE; // 테스트 번호
      const message = "(광고) 아직 설문이 완료되지 않았어요! 설문을 완료하고 프로필을 완성해보세요 :)";

      // 콘솔에 메시지 발송 성공 출력
      console.log(`${name}님에게 메세지 발송을 완료하였습니다.`);

      // 첫 번째 사용자에게만 실제 문자 전송
      if (!firstUserProcessed) {
        console.log(`[SMS 전송 테스트] ${name}님 (${phone}): 실제 문자 전송`);
        await sendSMS(phone, message);
        firstUserProcessed = true; // 첫 번째 사용자 처리 완료
      }

      // 주석 해제 시, 모든 사용자에게 문자 전송 (테스트 이후 활성화 가능)
      // await sendSMS(phone, message);
    });
  } catch (error) {
    console.error("Firebase 쿼리 중 오류 발생:", error);
  }
}

// 스케줄러 설정
const cron = require("node-cron");
cron.schedule("46 15 * * *", async () => {
  console.log("[스케줄러] 신규 미설문자 처리 시작");
  await handleNewIncompleteSurveys();
  console.log("[스케줄러] 신규 미설문자 처리 완료");
});
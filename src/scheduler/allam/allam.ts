import dotenv from "dotenv";
import cron from "node-cron";
import db from "../../firebase/firebase";
import { sendSMS } from "../sms"

dotenv.config(); // .env 파일 로드

// 신규 미설문자 처리 함수
async function handleNewIncompleteSurveys(): Promise<void> {
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

    let firstUserProcessed = false; // 첫 번째 사용자 처리 여부

    // QuerySnapshot을 배열로 변환하여 forEach 대신 for-of 사용
    const docs = snapshot.docs;

    for (let index = 0; index < docs.length; index++) {
      const doc = docs[index];
      const user = doc.data();
      const name = user.userName as string;
      const phone = process.env.TEST_PHONE || "";
      const message = `(광고) ${name}님, 아직 설문이 완료되지 않았어요! 설문을 완료하고 프로필을 완성해보세요 :)`;

      if (!firstUserProcessed) {
        // 첫 번째 사용자에게만 SMS 전송
        console.log(`[SMS 전송 테스트] ${name}님 (${phone}): 실제 문자 전송`);
        await sendSMS(phone, message);
        firstUserProcessed = true;
      } else {
        // 나머지 사용자 정보는 콘솔에 출력
        console.log(`대상자 [${index + 1}]: ${JSON.stringify(user)}`);
      }
    }
  } catch (error: any) {
    console.error("Firebase 쿼리 중 오류 발생:", error.message);
  }
}


// runSchedulerTask 함수 내보내기
export async function runSchedulerTask(): Promise<void> {
  console.log("[스케줄러] 신규 미설문자 처리 시작");
  await handleNewIncompleteSurveys();
  console.log("[스케줄러] 신규 미설문자 처리 완료");
}


cron.schedule("25 14 * * *", async () => {
  await runSchedulerTask();
});

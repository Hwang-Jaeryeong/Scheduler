import dotenv from "dotenv";
// import cron from "node-cron";
import db from "../../firebase/firebase";
import { sendSMS } from "../sms"

dotenv.config();

// 신규 미설문자 처리 함수
async function handleNewIncompleteSurveys(): Promise<void> {
  try {
    // A, B, C에 해당 안되는 ....?
    const datingSnapshot = await db
      .collection("user")
      .where("dating.datingGroup", "not-in", ["A", "B", "C"])
      .get();

    const meetingSnapshot = await db
      .collection("user")
      .where("meeting.meetingGroup", "not-in", ["A", "B", "C"])
      .get();

    const uniqueUsers = new Map();
    datingSnapshot.forEach((doc) => uniqueUsers.set(doc.id, doc.data()));
    meetingSnapshot.forEach((doc) => uniqueUsers.set(doc.id, doc.data()));

    const users = Array.from(uniqueUsers.values());

    // 대상자가 없을 경우 로깅 후 종료
    if (users.length === 0) {
      console.log("필터링된 대상자가 없습니다.");
      return;
    }

    console.log(`[${users.length}명] 필터링되지 않은 대상자 확인 완료`);

    let firstUserProcessed = false; // 첫 번째 사용자 처리 여부

    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      const name = user.userName as string;

      // 테스트를 위한 전화번호 또는 실제 전화번호
      // const phone = process.env.TEST_PHONE || user.phoneNumber || "";
      const phone = process.env.TEST_PHONE || "";
      if (!phone) {
        console.warn(`대상자 [${index + 1}]의 전화번호가 없습니다: ${JSON.stringify(user)}`);
        continue; // 전화번호가 없으면 다음 사용자로 넘어감
      }

      const message = `(광고) ${name}님, 아직 설문이 완료되지 않았어요! 설문을 완료하고 프로필을 완성해보세요 :)`;

      if (!firstUserProcessed) {
        // 첫 번째 사용자에게만 SMS 전송
        console.log(`[SMS 전송 테스트] ${name}님 (${phone}): 실제 문자 전송`);
        await sendSMS(phone, message);
        firstUserProcessed = true;
      } else {
        // 나머지 사용자 정보는 콘솔에 출력
        // console.log(`대상자 [${index + 1}]: ${JSON.stringify(user.userPhone)}`);
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

if (require.main === module) {
  runSchedulerTask();
}
// cron.schedule("20 15 * * *", async () => {
//   await runSchedulerTask();
// });
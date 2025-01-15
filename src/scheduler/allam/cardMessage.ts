import dotenv from "dotenv";
import db from "../../firebase/firebase";
import { Timestamp } from "firebase-admin/firestore";
import cron from "node-cron";
import { sendSMS } from "../sms"

dotenv.config();
const testPhone = process.env.TEST_PHONE;


// 일주일 간 가입한 사용자 추출
async function getRecentUsers(): Promise<any[]> {
  const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const snapshot = await db.collection("user").where("userTime", ">=", oneWeekAgo).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    userName: doc.data().userName || `User_${doc.id}`,
    userPhone: doc.data().userPhone || "NoPhone",
    userGender: doc.data().userGender,
  }));
}

// 사용자 카드 확인
export async function checkUserCards(user: any, handleDate: Date): Promise<{ meetingCards: any[]; datingCards: any[] }> {
  const meetingCards: any[] = [];
  const datingCards: any[] = [];

  let maleMatchTime: Date, femaleMatchTime: Date;

  if (handleDate.getHours() >= 23) {
    maleMatchTime = new Date(handleDate.setHours(23, 0, 0, 0));
    femaleMatchTime = new Date(handleDate.setHours(13, 0, 0, 0) - 24 * 60 * 60 * 1000);
  } else if (handleDate.getHours() >= 13) {
    maleMatchTime = new Date(handleDate.setHours(13, 0, 0, 0));
    femaleMatchTime = new Date(handleDate.setHours(23, 0, 0, 0) - 24 * 60 * 60 * 1000);
  } else {
    maleMatchTime = new Date(handleDate.setHours(23, 0, 0, 0) - 24 * 60 * 60 * 1000);
    femaleMatchTime = new Date(handleDate.setHours(13, 0, 0, 0) - 24 * 60 * 60 * 1000);
  }

  if (user.userGender === 1) {
    const meetingSnapshot = await db.collection("meetingMatch")
      .where("meetingMatchUserIdMale", "==", user.id)
      .where("meetingMatchTime", "==", Timestamp.fromDate(maleMatchTime))
      .get();

    const datingSnapshot = await db.collection("datingMatch")
      .where("datingMatchUserIdMale", "==", user.id)
      .where("datingMatchTime", "==", Timestamp.fromDate(maleMatchTime))
      .get();

    meetingCards.push(...meetingSnapshot.docs.map((doc) => doc.data()));
    datingCards.push(...datingSnapshot.docs.map((doc) => doc.data()));
  } else {
    const meetingSnapshot = await db.collection("meetingMatch")
      .where("meetingMatchUserIdFemale", "==", user.id)
      .where("meetingMatchTime", "==", Timestamp.fromDate(femaleMatchTime))
      .get();

    const datingSnapshot = await db.collection("datingMatch")
      .where("datingMatchUserIdFemale", "==", user.id)
      .where("datingMatchTime", "==", Timestamp.fromDate(femaleMatchTime))
      .get();

    meetingCards.push(...meetingSnapshot.docs.map((doc) => doc.data()));
    datingCards.push(...datingSnapshot.docs.map((doc) => doc.data()));
  }

  return { meetingCards, datingCards };
}


// 메시지 추출 및 발송 작업
export async function extractAndSendMessages(log: (message: string) => void): Promise<void> {
  log("extractAndSendMessages 실행 시작");
  const handleDate = new Date();
  const users = await getRecentUsers();
  const eligibleUsers: any[] = [];

  for (const user of users) {
    // checkUserCards 함수 호출
    const { meetingCards, datingCards } = await checkUserCards(user, handleDate);

    // meetingCount와 datingCount 계산
    const meetingCount = meetingCards.length;
    const datingCount = datingCards.length;

    log(
      `User: ${user.userPhone}, ${user.userName}, meetingCard: ${meetingCount}, datingCard: ${datingCount}`
    );

    if (meetingCount > 0 || datingCount > 0) {
      eligibleUsers.push({ ...user, meetingCount, datingCount });
    }
  }

  if (eligibleUsers.length === 0) {
    log("발송 대상자가 없습니다.");
    return;
  }

  const firstUser = eligibleUsers[0];
  const message =
    firstUser.meetingCount > 0 && firstUser.datingCount > 0
      ? `(광고) [미팅 / 소개팅] ${firstUser.userName}님, 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1`
      : firstUser.meetingCount > 0
      ? `(광고) [미팅] ${firstUser.userName}님, 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1`
      : `(광고) [소개팅] ${firstUser.userName}님, 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1`;

  log(`[TEST] Sending message to: ${firstUser.userPhone}, Content: "${message}"`);
  await sendSMS(testPhone!, message);
}


// 스케줄러 설정
// 지금(이건 테스트를 위해 집어넣음)
cron.schedule("58 1 * * *", () => {
    const log = (message: string) => console.log(message); // 로그 함수 정의
    extractAndSendMessages(log);
});
// cron.schedule("15 13 * * *", extractAndSendMessages); // 오후 1시 15분
// cron.schedule("15 23 * * *", extractAndSendMessages); // 오후 11시 15분
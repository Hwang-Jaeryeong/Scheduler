import dotenv from "dotenv";
import db from "./firebase/firebase";
import { Timestamp } from "firebase-admin/firestore";
import { sendSMS } from "./scheduler/sms";
import { calculateLastTime, calculateTwoTimesAgo } from "./scheduler/allam/profileCouponAlert";

dotenv.config();
const testPhone = process.env.TEST_PHONE;

// 일주일 간 가입한 사용자 추출
async function getRecentUsers(): Promise<any[]> {
  const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  console.log("oneWeekAgo:", oneWeekAgo.toDate());

  const snapshot = await db.collection("user").where("userTime", ">=", oneWeekAgo).get();
  console.log("user 컬렉션 문서 수:", snapshot.size);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    userName: doc.data().userName || `User_${doc.id}`,
    userPhone: doc.data().userPhone || "NoPhone",
    userGender: doc.data().userGender,
  }));
}

// 사용자 카드 확인
export async function checkUserCards(
  user: any,
  handleDate: Date
): Promise<{ meetingCards: any[]; datingCards: any[] }> {
  const meetingCards: any[] = [];
  const datingCards: any[] = [];

  // 기준 시간 계산
  const lastTime = calculateLastTime(handleDate); // 최근 기준 시간 (13시 또는 23시)
  const twoTimesAgo = calculateTwoTimesAgo(lastTime); // 두 타임 전 기준 시간

  if (user.userGender === 1) {
    // 남성 유저: 기준 시간 = lastTime ± 1분
    const startTime = new Date(lastTime);
    startTime.setMinutes(startTime.getMinutes() - 1); // -1분
    const endTime = new Date(lastTime);
    endTime.setMinutes(endTime.getMinutes() + 1); // +1분

    const meetingSnapshot = await db.collection("meetingMatch")
      .where("meetingMatchUserIdMale", "==", user.id)
      .where("meetingMatchTime", ">=", Timestamp.fromDate(startTime))
      .where("meetingMatchTime", "<=", Timestamp.fromDate(endTime))
      .get();

    const datingSnapshot = await db.collection("datingMatch")
      .where("datingMatchUserIdMale", "==", user.id)
      .where("datingMatchTime", ">=", Timestamp.fromDate(startTime))
      .where("datingMatchTime", "<=", Timestamp.fromDate(endTime))
      .get();

    meetingCards.push(...meetingSnapshot.docs.map((doc) => doc.data()));
    datingCards.push(...datingSnapshot.docs.map((doc) => doc.data()));
  } else {
    // 여성 유저: 기준 시간 = twoTimesAgo ± 1분
    const startTime = new Date(twoTimesAgo);
    startTime.setMinutes(startTime.getMinutes() - 1); // -1분
    const endTime = new Date(twoTimesAgo);
    endTime.setMinutes(endTime.getMinutes() + 1); // +1분

    const meetingSnapshot = await db.collection("meetingMatch")
      .where("meetingMatchUserIdFemale", "==", user.id)
      .where("meetingMatchTime", ">=", Timestamp.fromDate(startTime))
      .where("meetingMatchTime", "<=", Timestamp.fromDate(endTime))
      .get();

    const datingSnapshot = await db.collection("datingMatch")
      .where("datingMatchUserIdFemale", "==", user.id)
      .where("datingMatchTime", ">=", Timestamp.fromDate(startTime))
      .where("datingMatchTime", "<=", Timestamp.fromDate(endTime))
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

if (require.main === module) {
  const log = (message: string) => console.log(message); // 로그 함수 정의
  extractAndSendMessages(log);
}
import dotenv from "dotenv";
import db from "../../firebase/firebase";
// import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
// import { sendSMS } from "../sms"

dotenv.config();
// const testPhone = process.env.TEST_PHONE;

// 기준 타임 계산 함수
export function calculateLastTime(now: Date): Date {
  const times = [13, 23];
  const lastTime = new Date(now);

  if (now.getHours() < times[0]) {
    lastTime.setDate(now.getDate() - 1);
    lastTime.setHours(times[1], 0, 0, 0);
  } else if (now.getHours() < times[1]) {
    lastTime.setHours(times[0], 0, 0, 0);
  } else {
    lastTime.setHours(times[1], 0, 0, 0);
  }

  return lastTime;
}

export function calculateTwoTimesAgo(lastTime: Date): Date {
  const twoTimesAgo = new Date(lastTime);

  if (lastTime.getHours() === 13) {
    twoTimesAgo.setDate(lastTime.getDate() - 1);
    twoTimesAgo.setHours(23);
  } else {
    twoTimesAgo.setHours(13);
  }

  twoTimesAgo.setMinutes(0, 0, 0);
  return twoTimesAgo;
}

// Firestore의 `IN` 제한(30개) 해결: 배열을 30개씩 나누는 함수
export function chunkArray(array: any[], size: number) {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

// 실행 함수
export async function executeProfileCouponAlert(handleDate?: Date): Promise<string[]> {
  console.log("profileCouponAlert start");
  const logs: string[] = [];
  logs.push("profileCouponAlert start");

  const now = handleDate ? new Date(handleDate) : Timestamp.now().toDate();
  const lastTime = new Date(now);
  lastTime.setHours(23, 0, 0, 0);
  const twoTimesAgo = new Date(lastTime);
  twoTimesAgo.setDate(lastTime.getDate() - 1);

  // Firestore에서 유저 데이터 가져오기 (한 번에!)
  const usersSnapshot = await db.collection("user")
    .where("userGender", "==", 1)
    .select("userName", "userPhone", "userGender", "userPointBuy", "userPointUse", "meeting", "dating")
    .get();

  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    userName: doc.data().userName,
    userPhone: doc.data().userPhone,
    userGender: doc.data().userGender,
    userPointBuy: doc.data().userPointBuy || 0,
    userPointUse: doc.data().userPointUse || 0,
    meetingIsOn: doc.data().meeting?.meetingIsOn || false,
    meetingGroup: doc.data().meeting?.meetingGroup || "",
    datingIsOn: doc.data().dating?.datingIsOn || false,
    datingGroup: doc.data().dating?.datingGroup || "",
  }));

  const userIds = users.map(user => user.id);

  // 유저 ID를 30개씩 나누어서 Firestore에서 가져오기
  const userIdChunks = chunkArray(userIds, 30);

  let meetingMatches: any[] = [];
  let datingMatches: any[] = [];

  for (const chunk of userIdChunks) {
    const [meetingMatchSnapshot, datingMatchSnapshot] = await Promise.all([
      db.collection("meetingMatch")
        .where("meetingMatchUserIdMale", "in", chunk)
        .where("meetingMatchTime", ">=", Timestamp.fromDate(twoTimesAgo))
        .where("meetingMatchTime", "<=", Timestamp.fromDate(lastTime))
        .select("meetingMatchUserIdMale", "meetingMatchPayMale")
        .get(),
      db.collection("datingMatch")
        .where("datingMatchUserIdMale", "in", chunk)
        .where("datingMatchTime", ">=", Timestamp.fromDate(twoTimesAgo))
        .where("datingMatchTime", "<=", Timestamp.fromDate(lastTime))
        .select("datingMatchUserIdMale", "datingMatchPayMale")
        .get(),
    ]);

    meetingMatches.push(...meetingMatchSnapshot.docs.map(doc => doc.data()));
    datingMatches.push(...datingMatchSnapshot.docs.map(doc => doc.data()));
  }

  // 유저 ID 기준으로 선결제 유저 목록 만들기
  const prepaidUsers = new Set();
  meetingMatches.forEach(doc => {
    if (doc.meetingMatchPayMale === 3) prepaidUsers.add(doc.meetingMatchUserIdMale);
  });
  datingMatches.forEach(doc => {
    if (doc.datingMatchPayMale === 3) prepaidUsers.add(doc.datingMatchUserIdMale);
  });

  // 메시지 전송할 유저 필터링
  const sentNumbers = new Set();
  let totalUsers = users.length;
  let prepaidUsersCount = 0;
  let picksUsersCount = 0;
  let activeUsersCount = 0;
  let messageSentCount = 0;

  for (const user of users) {
    if (sentNumbers.has(user.userPhone)) continue;

    const isPrepaid = prepaidUsers.has(user.id);
    if (isPrepaid) prepaidUsersCount++;

    const has400Picks = user.userPointBuy - user.userPointUse >= 400;
    if (has400Picks) picksUsersCount++;

    const isActive =
      (user.meetingIsOn && user.meetingGroup === "A") ||
      (user.datingIsOn && user.datingGroup === "A");
    if (isActive) activeUsersCount++;

    // 메시지 생성 및 발송
    let message: string | null = null;
    if (isPrepaid) {
      message = "(광고) 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
    }

    if (message) {
      sentNumbers.add(user.userPhone);
      // logs.push(`Sending message to ${user.userPhone}: "${message}"`);
      // await sendSMS(testPhone!, message);
      messageSentCount++;
    }
  }

  logs.push("===== 실행 통계 =====");
  logs.push(`총 유저 수: ${totalUsers}`);
  logs.push(`선결제 유저 수: ${prepaidUsersCount}`);
  logs.push(`400픽 보유 유저 수: ${picksUsersCount}`);
  logs.push(`활성화 유저 수: ${activeUsersCount}`);

  return logs;
}

if (require.main === module) {
  executeProfileCouponAlert();
}

// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 13:00...");
//   executeProfileCouponAlert();
// });

// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 23:00...");
//   executeProfileCouponAlert();
// });
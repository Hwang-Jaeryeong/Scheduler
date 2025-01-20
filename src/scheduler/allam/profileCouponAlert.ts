import dotenv from "dotenv";
import db from "../../firebase/firebase";
// import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
// import { sendSMS } from "../sms"

dotenv.config();
// const testPhone = process.env.TEST_PHONE;

// 기준 타임 계산 함수
function calculateLastTime(now: Date): Date {
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

function calculateTwoTimesAgo(lastTime: Date): Date {
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

// 선결제 여부 확인 함수
async function checkPrepaid(userId: string, lastTime: Date): Promise<boolean> {
  const twoTimesAgo = calculateTwoTimesAgo(lastTime);

  const startTime = new Date(twoTimesAgo);
  startTime.setMinutes(twoTimesAgo.getMinutes() - 1);
  const endTime = new Date(twoTimesAgo);
  endTime.setMinutes(twoTimesAgo.getMinutes() + 1);

  const snapshots = await Promise.all([
    db.collection("meetingMatch")
      .where("meetingMatchUserIdMale", "==", userId)
      .where("meetingMatchTime", ">=", Timestamp.fromDate(startTime))
      .where("meetingMatchTime", "<=", Timestamp.fromDate(endTime))
      .get(),
    db.collection("datingMatch")
      .where("datingMatchUserIdMale", "==", userId)
      .where("datingMatchTime", ">=", Timestamp.fromDate(startTime))
      .where("datingMatchTime", "<=", Timestamp.fromDate(endTime))
      .get(),
  ]);

  return snapshots.some((snapshot) =>
    snapshot.docs.some(
      (doc) =>
        doc.data().meetingMatchPayMale === 3 ||
        doc.data().datingMatchPayMale === 3
    )
  );
}

// 메시지 생성 함수
function generateProfileCouponMessage(isPrepaid: boolean, has400Picks: boolean): string | null {
  if (isPrepaid) {
    return "(광고) 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
  }
  if (has400Picks) {
    return null;
  }
  return null;
}

// 실행 함수
export async function executeProfileCouponAlert(handleDate?: Date): Promise<string[]> {
  const logs: string[] = [];
  console.log("profileCouponAlert start");
  logs.push("profileCouponAlert start");

  // 현재 시간 설정: 요청 바디에서 제공된 시간 또는 Firebase Admin의 시간 사용
  const now = handleDate ? new Date(handleDate) : Timestamp.now().toDate();
  const lastTime = calculateLastTime(now);

  const users = await db.collection("user")
    .where("userGender", "==", 1)
    .get()
    .then((snapshot) =>
      snapshot.docs.map((doc) => ({
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
      }))
    );

  const sentNumbers = new Set();
  let totalUsers = users.length;
  let prepaidUsersCount = 0;
  let picksUsersCount = 0;
  let activeUsersCount = 0;
  let messageSentCount = 0;

  for (const user of users) {
    if (sentNumbers.has(user.userPhone)) continue;

    const isPrepaid = await checkPrepaid(user.id, lastTime);
    if (isPrepaid) prepaidUsersCount++;

    const has400Picks = user.userPointBuy - user.userPointUse >= 400;
    if (has400Picks) picksUsersCount++;

    const isActive =
      (user.meetingIsOn && user.meetingGroup === "A") ||
      (user.datingIsOn && user.datingGroup === "A");
    if (isActive) activeUsersCount++;

    const message = generateProfileCouponMessage(isPrepaid, has400Picks && isActive);

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
import dotenv from "dotenv";
import db from "../../firebase/firebase";
import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
import { sendSMS } from "../sms"

dotenv.config();
const testPhone = process.env.TEST_PHONE;


// 기준 타임 계산 함수 (그 시각 기준)
function calculateLastTime(now: Date): Date {
  const times = [13, 23]; // 기준 타임 (13:00, 23:00)
  const lastTime = new Date(now);

  // 현재 시간을 기준으로 가장 가까운 이전 타임 계산
  if (now.getHours() < times[0]) {
    lastTime.setDate(now.getDate() - 1); // 전날 23:00
    lastTime.setHours(times[1], 0, 0, 0);
  } else if (now.getHours() < times[1]) {
    lastTime.setHours(times[0], 0, 0, 0); // 오늘 13:00
  } else {
    lastTime.setHours(times[1], 0, 0, 0); // 오늘 23:00
  }

  return lastTime;
}

// 선결제 여부 확인
async function checkPrepaid(userId: string, lastTime: Date): Promise<boolean> {
  const twoTimesAgo = new Date(lastTime);
  twoTimesAgo.setHours(lastTime.getHours() === 23 ? 13 : 23);
  if (lastTime.getHours() === 13) {
    twoTimesAgo.setDate(lastTime.getDate() - 1); // 전날로 변경
    }

  // 두 타임 전 row를 가져옴
  const snapshots = await Promise.all([
    db.collection("meetingMatch")
      .where("meetingMatchUserIdMale", "==", userId)
      .where("meetingMatchTime", "==", Timestamp.fromDate(twoTimesAgo))
      .get(),
    db.collection("datingMatch")
      .where("datingMatchUserIdMale", "==", userId)
      .where("datingMatchTime", "==", Timestamp.fromDate(twoTimesAgo))
      .get(),
  ]);

  // 각 스냅샷에서 MatchPayMale === 3인 row가 하나라도 있는지 확인
  return snapshots.some((snapshot) =>
    snapshot.docs.some((doc) => doc.data().meetingMatchPayMale === 3 || doc.data().datingMatchPayMale === 3)
  );
}

// 메시지 생성 함수
function generateProfileCouponMessage(isPrepaid: boolean, has400Picks: boolean): string | null {
  if (isPrepaid) {
    return "(광고) 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
  }
  if (has400Picks) {
    // return "(광고) 400픽 보유 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
    return null;
  }
  return null;
}

// 실행 함수
async function executeProfileCouponAlert(): Promise<void> {
  const now = Timestamp.now().toDate(); // Firebase 서버 시간 기준
  const lastTime = calculateLastTime(now); // 그 시각 계산

  const users = await db.collection("user").get().then((snapshot) =>
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

  const sentNumbers = new Set(); // 중복 방지
  let totalUsers = users.length;
  let prepaidUsersCount = 0;
  let picksUsersCount = 0;
  let activeUsersCount = 0;
  let messageSentCount = 0;

  for (const user of users) {
    if (sentNumbers.has(user.userPhone)) continue;

    // 선결제 여부 확인
    const isPrepaid = await checkPrepaid(user.id, lastTime);
    if (isPrepaid) prepaidUsersCount++;

    // 400픽 보유 여부 확인 (그 시각 기준)
    const has400Picks = user.userPointBuy - user.userPointUse >= 400;
    if (has400Picks) picksUsersCount++;

    // 활성화 여부 확인
    const isActive =
      (user.meetingIsOn && user.meetingGroup === "A") ||
      (user.datingIsOn && user.datingGroup === "A");
    if (isActive) activeUsersCount++;

    // 메시지 생성
    const message = generateProfileCouponMessage(isPrepaid, has400Picks && isActive);

    if (message) {
      console.log(`Sending message to ${user.userPhone}: "${message}"`);
      // 실제 메시지 전송 코드
      await sendSMS(testPhone!, message);
      sentNumbers.add(user.userPhone);
      messageSentCount++;
    }
  }

  console.log("===== 실행 통계 =====");
  console.log(`총 유저 수: ${totalUsers}`);
  console.log(`선결제 유저 수: ${prepaidUsersCount}`);
  console.log(`400픽 보유 유저 수: ${picksUsersCount}`);
  console.log(`활성화 유저 수: ${activeUsersCount}`);
  console.log(`메시지 발송 유저 수: ${messageSentCount}`);
}
// 스케줄러 (Test 용용)
cron.schedule("59 13 * * *", () => {
    console.log("Executing Card Delete Alarm Scheduler...");
    executeProfileCouponAlert();
  });

// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 13:00...");
//   executeProfileCouponAlert();
// });

// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 23:00...");
//   executeProfileCouponAlert();
// });
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
    twoTimesAgo.setHours(23, 0, 0, 0);
  } else {
    twoTimesAgo.setHours(13, 0, 0, 0);
  }

  return twoTimesAgo;
}

// 후결제 여부 확인
async function checkPostpaid(
  userId: string,
  lastTime: Date
): Promise<{ isGeneral: boolean; isFemalePrepaid: boolean }> {
  const twoTimesAgo = calculateTwoTimesAgo(lastTime);

  // 1분 전과 1분 후의 범위
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

  let isGeneral = false;
  let isFemalePrepaid = false;

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.meetingMatchPayMale === 1 || data.datingMatchPayMale === 1) {
        if (data.meetingMatchCheckMale === 3 && data.meetingMatchCheckFemale === 3) {
          if (data.meetingMatchFirstView === 1 || data.datingMatchFirstView === 1) {
            isGeneral = true;
          }
          if (data.meetingMatchFirstView === 2 || data.datingMatchFirstView === 2) {
            isFemalePrepaid = true;
          }
        }
      }
    });
  });

  return { isGeneral, isFemalePrepaid };
}

// 메시지 생성 함수
function generatePostpaidMessage(isFemalePrepaid: boolean, isGeneral: boolean): string | null {
    if (isFemalePrepaid) {
      return "(광고) 상대가 먼저 호감을 보냈어요! 오늘 밤 10시까지 연락처를 확인하세요! bit.ly/YP-DAY1";
    }
    if (isGeneral) {
      return "(광고) 매칭 성사 완료! 오늘 밤 10시까지 연락처를 확인하세요! bit.ly/YP-DAY1";
    }
    return null;
}

// 실행 함수
export async function executePostpaidAlert(): Promise<string[]> {
  const logs: string[] = [];
  logs.push("postpayer start");
  const now = Timestamp.now().toDate();
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
      }))
    );

  const sentNumbers = new Set();
  let totalMaleUsers = 0;
  let generalPostpaidCount = 0;
  let femalePrepaidCount = 0;

  for (const user of users) {
    totalMaleUsers++;

    if (sentNumbers.has(user.userPhone)) continue;

    const { isGeneral, isFemalePrepaid } = await checkPostpaid(user.id, lastTime);

    if (isGeneral) generalPostpaidCount++;
    if (isFemalePrepaid) femalePrepaidCount++;

    const message = generatePostpaidMessage(isFemalePrepaid, isGeneral);

    if (message) {
      // logs.push(`Sending message to ${user.userPhone}: "${message}"`);
      sentNumbers.add(user.userPhone);
    }
  }

  logs.push("===== 실행 통계 =====");
  logs.push(`전체 남자 유저 수: ${totalMaleUsers}`);
  logs.push(`일반 후결제 유저 수: ${generalPostpaidCount}`);
  logs.push(`여성 선매칭 후결제 유저 수: ${femalePrepaidCount}`);

  return logs; // logs 반환
}


if (require.main === module) {
    executePostpaidAlert();
}

// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Postpaid Alert Scheduler at 13:00...");
//   executePostpaidAlert();
// });

// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Postpaid Alert Scheduler at 23:00...");
//   executePostpaidAlert();
// });

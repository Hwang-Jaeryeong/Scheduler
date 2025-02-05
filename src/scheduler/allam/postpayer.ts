import dotenv from "dotenv";
import db from "../../firebase/firebase";
// import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
// import { sendSMS } from "../sms"
import { chunkArray } from "./profileCouponAlert";

dotenv.config();

// const testPhone = process.env.TEST_PHONE;

// ✅ 기준 타임 계산 함수
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

  if (lastTime.getHours() == 13) {
    twoTimesAgo.setDate(lastTime.getDate() - 1);
    twoTimesAgo.setHours(23, 0, 0, 0);
  } else {
    twoTimesAgo.setHours(13, 0, 0, 0);
  }

  return twoTimesAgo;
}

// ✅ 실행 함수
export async function executePostpaidAlert(): Promise<string[]> {
  const logs: string[] = [];
  logs.push("postpayer start");
  const now = Timestamp.now().toDate();
  const lastTime = calculateLastTime(now);
  const twoTimesAgo = calculateTwoTimesAgo(lastTime);

  // ✅ 1️⃣ Firestore에서 유저 데이터 가져오기
  const usersSnapshot = await db.collection("user")
    .where("userGender", "==", 1)
    .select("userName", "userPhone", "userGender", "dating", "meeting")
    .get();

  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    userName: doc.data().userName,
    userPhone: doc.data().userPhone,
    userGender: doc.data().userGender,
    meetingGroupA: doc.data().meeting?.meetingGroup === "A" && doc.data().meeting?.meetingIsOn === true,
    datingGroupA: doc.data().dating?.datingGroup === "A" && doc.data().dating?.datingIsOn === true,
  }));

  const userIds = users.map(user => user.id);

  // ✅ 2️⃣ Firestore에서 meetingMatch, datingMatch 데이터 가져오기 (기존 로직 유지)
  const userIdChunks = chunkArray(userIds, 30);

  let postpaidUsers = new Map();

  for (const chunk of userIdChunks) {
    const [meetingMatchSnapshot, datingMatchSnapshot] = await Promise.all([
      db.collection("meetingMatch")
        .where("meetingMatchUserIdMale", "in", chunk)
        .where("meetingMatchTime", ">=", Timestamp.fromDate(twoTimesAgo))
        .where("meetingMatchTime", "<=", Timestamp.fromDate(lastTime))
        .select("meetingMatchUserIdMale", "meetingMatchFirstView", "meetingMatchCheckMale", "meetingMatchCheckFemale", "meetingMatchPayMale")
        .get(),
      db.collection("datingMatch")
        .where("datingMatchUserIdMale", "in", chunk)
        .where("datingMatchTime", ">=", Timestamp.fromDate(twoTimesAgo))
        .where("datingMatchTime", "<=", Timestamp.fromDate(lastTime))
        .select("datingMatchUserIdMale", "datingMatchFirstView", "datingMatchCheckMale", "datingMatchCheckFemale", "datingMatchPayMale")
        .get(),
    ]);

    meetingMatchSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.meetingMatchPayMale === 1 && data.meetingMatchCheckMale === 3 && data.meetingMatchCheckFemale === 3) {
        postpaidUsers.set(data.meetingMatchUserIdMale, {
          isGeneral: data.meetingMatchFirstView === 1,
          isFemalePrepaid: data.meetingMatchFirstView === 2
        });
      }
    });

    datingMatchSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.datingMatchPayMale === 1 && data.datingMatchCheckMale === 3 && data.datingMatchCheckFemale === 3) {
        postpaidUsers.set(data.datingMatchUserIdMale, {
          isGeneral: data.datingMatchFirstView === 1,
          isFemalePrepaid: data.datingMatchFirstView === 2
        });
      }
    });
  }

  // ✅ 3️⃣ 메시지 전송할 유저 필터링
  const sentNumbers = new Set();
  let totalMaleUsers = users.length;
  let generalPostpaidCount = 0;
  let femalePrepaidCount = 0;
  let messageSentCount = 0;

  for (const user of users) {
    if (sentNumbers.has(user.userPhone)) continue;

    const postpaidStatus = postpaidUsers.get(user.id) || { isGeneral: false, isFemalePrepaid: false };
    if (postpaidStatus.isGeneral) generalPostpaidCount++;
    if (postpaidStatus.isFemalePrepaid) femalePrepaidCount++;

    let message: string | null = null;
    if (postpaidStatus.isFemalePrepaid) {
      message = "(광고) 상대가 먼저 호감을 보냈어요! 오늘 밤 10시까지 연락처를 확인하세요! bit.ly/YP-DAY1";
    }
    if (postpaidStatus.isGeneral) {
      message = "(광고) 매칭 성사 완료! 오늘 밤 10시까지 연락처를 확인하세요! bit.ly/YP-DAY1";
    }

    if (message) {
      sentNumbers.add(user.userPhone);
      messageSentCount++;
    }
  }

  logs.push("===== 실행 통계 =====");
  logs.push(`전체 남자 유저 수: ${totalMaleUsers}`);
  logs.push(`일반 후결제 유저 수: ${generalPostpaidCount}`);
  logs.push(`여성 선매칭 후결제 유저 수: ${femalePrepaidCount}`);

  return logs;
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

import dotenv from "dotenv";
import crypto from "crypto";
import axios from "axios";
import db from "../../firebase/firebase";
import { Timestamp } from "firebase-admin/firestore";
// import cron from "node-cron";

dotenv.config(); // .env 파일 로드

// 네이버 SENS API 설정
const accessKey = process.env.SENS_ACCESS_KEY;
const secretKey = process.env.SENS_SECRET_KEY;
const serviceId = process.env.SENS_SERVICE_ID;
const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;

if (!accessKey || !secretKey || !serviceId) {
  throw new Error("환경 변수가 올바르게 설정되지 않았습니다.");
}

// 유저 데이터 타입 정의
interface User {
  id: string;
  userName: string;
  userPhone: string;
  userType: "all" | "dating" | "meeting";
  userTime: FirebaseFirestore.Timestamp;
}

// 서명 생성 함수
function makeSignature(timestamp: string): string {
  const method = "POST";
  const uri = `/sms/v2/services/${serviceId}/messages`;
  const message = `${method} ${uri}\n${timestamp}\n${accessKey}`;
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(message);
  return hmac.digest("base64");
}

// 문자 전송 함수
async function sendSMS(phone: string, message: string): Promise<void> {
  const timestamp = Date.now().toString();
  const signature = makeSignature(timestamp);

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "x-ncp-apigw-timestamp": timestamp,
    "x-ncp-iam-access-key": accessKey,
    "x-ncp-apigw-signature-v2": signature,
  };

  const body = {
    type: "SMS",
    from: process.env.SENDER_PHONE || "",
    content: message,
    messages: [{ to: phone }],
  };

  try {
    const response = await axios.post(url, body, { headers });
    console.log(`SMS 발송 성공: ${response.data.requestId}`);
  } catch (error: any) {
    console.error("SMS 요청 에러:", error.response?.data || error.message);
  }
}

// 일주일 이내 가입 여부 확인 함수
function isWithinAWeek(userTime: FirebaseFirestore.Timestamp | undefined): boolean {
    if (!userTime || !userTime.toDate) {
      // console.warn("userTime이 유효하지 않습니다:", userTime);
      return false;
    }
  
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return userTime.toDate() > oneWeekAgo;
}
  
// 결과 출력 함수 추가
function countUsersWithinAWeek(users: any[]): number {
    let validCount = 0;
  
    users.forEach((user) => {
      if (isWithinAWeek(user.userTime)) {
        validCount++;
      }
    });
  
    console.log(`일주일 이내 가입한 유저 수: ${validCount}`);
    return validCount;
  } 

// 대상 필터링 함수
async function getFilteredUsers(currentTime: Date, isMale: boolean): Promise<User[]> {
    const oneWeekAgo = Timestamp.fromDate(new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000));
    const today13 = Timestamp.fromDate(new Date(currentTime.setHours(13, 0, 0, 0)));
    const yesterday23 = Timestamp.fromDate(new Date(currentTime.getTime() - 14 * 60 * 60 * 1000));

    // Firestore에서 user 컬렉션 가져오기
    const userSnapshot = await db.collection("user")
        .select("userPhone", "userName", "userType", "userTime")
        .where("userTime", ">=", oneWeekAgo)
        .get();

    const users = userSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as User));

    const matchSnapshots: FirebaseFirestore.QuerySnapshot[] = [];

    for (const user of users) {
        if (isMale) {
            // 남성의 경우
            if (user.userType === "all" || user.userType === "dating") {
                // datingMatchTime 확인
                const datingMatchSnapshot = await db.collection("datingMatch")
                    .where("datingMatchTime", ">=", oneWeekAgo)
                    .where("datingMatchTime", "<=", today13)
                    .get();
                matchSnapshots.push(datingMatchSnapshot);
            }

            if (user.userType === "all" || user.userType === "meeting") {
                // meetingMatchTime 확인
                const meetingMatchSnapshot = await db.collection("meetingMatch")
                    .where("meetingMatchTime", ">=", oneWeekAgo)
                    .where("meetingMatchTime", "<=", today13)
                    .get();
                matchSnapshots.push(meetingMatchSnapshot);
            }
        } else {
            // 여성의 경우
            if (user.userType === "all" || user.userType === "dating") {
                // datingMatchTime 확인
                const datingMatchSnapshot = await db.collection("datingMatch")
                    .where("datingMatchTime", ">=", oneWeekAgo)
                    .where("datingMatchTime", "<=", yesterday23)
                    .get();
                matchSnapshots.push(datingMatchSnapshot);
            }

            if (user.userType === "all" || user.userType === "meeting") {
                // meetingMatchTime 확인
                const meetingMatchSnapshot = await db.collection("meetingMatch")
                    .where("meetingMatchTime", ">=", oneWeekAgo)
                    .where("meetingMatchTime", "<=", yesterday23)
                    .get();
                matchSnapshots.push(meetingMatchSnapshot);
            }
        }
    }

    const matches = matchSnapshots.flatMap((snapshot) =>
        snapshot.docs.map((doc) => doc.data())
    );

    console.log("Matches:", matches);

    const matchUserIds = new Set(
        matches.flatMap((match) => [
            match.datingMatchUserIdMale,
            match.datingMatchUserIdFemale,
            match.meetingMatchUserIdMale,
            match.meetingMatchUserIdFemale,
        ])
    );

    console.log("Match User IDs:", matchUserIds);

    // 중복 제거 및 필터링
    const phoneNumbers = new Set();
    const filteredUsers = users.filter((user) => {
        if (!matchUserIds.has(user.id) || phoneNumbers.has(user.userPhone)) {
            return false;
        }
        phoneNumbers.add(user.userPhone);
        return true;
    });

    console.log("Filtered Users:", filteredUsers);
    return filteredUsers;
}

// // 메시지 전송 작업
// async function sendMessages(currentTime: Date, isMale: boolean): Promise<void> {
//     const users = await getFilteredUsers(currentTime, isMale);
  
//     // groups 객체 타입 정의
//     const groups: {
//       all: User[];
//       dating: User[];
//       meeting: User[];
//     } = {
//       all: [],
//       dating: [],
//       meeting: [],
//     };
  
//     // 그룹 분리
//     users.forEach((user) => {
//       if (user.userType === "all") groups.all.push(user);
//       else if (user.userType === "dating") groups.dating.push(user);
//       else if (user.userType === "meeting") groups.meeting.push(user);
//     });
  
//     // 메시지 전송
//     for (const user of groups.all) {
//       if (!user.userPhone) {
//         console.warn(`전화번호 누락: ${user.userName}`);
//         continue;
//       }
//       try {
//         await sendSMS(
//           user.userPhone,
//           "(광고)[소개팅 / 미팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1"
//         );
//       } catch (error) {
//         console.error(`SMS 발송 실패 (all): ${user.userName}`, error);
//       }
//     }
  
//     for (const user of groups.dating) {
//       if (!user.userPhone) {
//         console.warn(`전화번호 누락: ${user.userName}`);
//         continue;
//       }
//       try {
//         await sendSMS(
//           user.userPhone,
//           "(광고)[소개팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1"
//         );
//       } catch (error) {
//         console.error(`SMS 발송 실패 (dating): ${user.userName}`, error);
//       }
//     }
  
//     for (const user of groups.meeting) {
//       if (!user.userPhone) {
//         console.warn(`전화번호 누락: ${user.userName}`);
//         continue;
//       }
//       try {
//         await sendSMS(
//           user.userPhone,
//           "(광고)[미팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1"
//         );
//       } catch (error) {
//         console.error(`SMS 발송 실패 (meeting): ${user.userName}`, error);
//       }
//     }
//   }
  

// // 스케줄러 설정
// cron.schedule("30 13 * * *", async () => {
//   console.log("13:30 메시지 전송 시작");
//   await sendMessages(new Date(), true); // 남성 대상
//   console.log("13:30 메시지 전송 완료");
// });

// cron.schedule("30 23 * * *", async () => {
//   console.log("23:30 메시지 전송 시작");
//   await sendMessages(new Date(), false); // 여성 대상
//   console.log("23:30 메시지 전송 완료");
// });

// 메시지 전송 작업 (테스트용)
async function sendMessagesTest(currentTime: Date, isMale: boolean): Promise<void> {
    const users = await getFilteredUsers(currentTime, isMale);
    const testPhone = process.env.TEST_PHONE;
  
    if (users.length === 0) {
      console.log("필터링된 유저가 없습니다.");
      return;
    }
  
    const firstUser = users[0];
    console.log("테스트 대상 유저:", firstUser);
  
    try {
      await sendSMS(
        testPhone!,
        "(광고)[소개팅] 테스트 메시지: 오늘의 인연 bit.ly/YP-DAY1"
      );
      console.log(`테스트 문자 발송 완료: ${testPhone}`);
    } catch (error) {
      console.error("테스트 문자 발송 실패:", error);
    }
}
  
async function main() {
    const currentTime = new Date();
    const isMale = true; // 남성 대상 여부

    // Firestore에서 유저 데이터를 가져오기
    const snapshot = await db.collection("user").get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as User));

    // 일주일 이내 가입한 유저 수 출력
    const validUserCount = countUsersWithinAWeek(users);
    console.log(`유효한 유저 수: ${validUserCount}`);

    // 필터링된 유저 가져오기 및 문자 테스트 전송
    const filteredUsers = await getFilteredUsers(currentTime, isMale);
    if (filteredUsers.length > 0) {
        await sendMessagesTest(currentTime, isMale);
    } else {
        console.log("필터링된 유저가 없습니다.");
    }
}

// main 함수 실행
main().catch((error) => {
    console.error("메인 함수 실행 중 오류:", error);
});
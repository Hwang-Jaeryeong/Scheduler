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

// // 일주일 이내 가입 여부 확인 함수
// function isWithinAWeek(userTime: FirebaseFirestore.Timestamp | undefined): boolean {
//     if (!userTime || !userTime.toDate) {
//       console.warn("userTime이 유효하지 않습니다:", userTime);
//       return false;
//     }
  
//     const now = new Date();
//     const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
//     return userTime.toDate() > oneWeekAgo;
// }
  
// // 결과 출력 함수 추가
// function countUsersWithinAWeek(users: any[]): number {
//     let validCount = 0;
  
//     users.forEach((user) => {
//       if (isWithinAWeek(user.userTime)) {
//         validCount++;
//       }
//     });
  
//     console.log(`일주일 이내 가입한 유저 수: ${validCount}`);
//     return validCount;
// } 

// 대상 필터링 함수
async function getFilteredUsers(currentTime: Date, isMale: boolean): Promise<User[]> {
    const today13 = Timestamp.fromDate(new Date(currentTime.setHours(13, 0, 0, 0))); // 오늘 13:00
    const yesterday23 = Timestamp.fromDate(new Date(currentTime.getTime() - 14 * 60 * 60 * 1000)); // 어제 23:00

    // Firestore에서 match 컬렉션 가져오기
    const matchSnapshots: FirebaseFirestore.QuerySnapshot[] = [];

    if (isMale) {
        // 남성의 경우 오늘 13:00에 해당하는 데이터 가져오기
        const datingMatchSnapshot = await db.collection("datingMatch")
            .where("datingMatchTime", "==", today13)
            .get();
        matchSnapshots.push(datingMatchSnapshot);

        const meetingMatchSnapshot = await db.collection("meetingMatch")
            .where("meetingMatchTime", "==", today13)
            .get();
        matchSnapshots.push(meetingMatchSnapshot);
    } else {
        // 여성의 경우 어제 23:00에 해당하는 데이터 가져오기
        const datingMatchSnapshot = await db.collection("datingMatch")
            .where("datingMatchTime", "==", yesterday23)
            .get();
        matchSnapshots.push(datingMatchSnapshot);

        const meetingMatchSnapshot = await db.collection("meetingMatch")
            .where("meetingMatchTime", "==", yesterday23)
            .get();
        matchSnapshots.push(meetingMatchSnapshot);
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

    // 중복 제거된 사용자 ID 목록 반환
    const users = Array.from(matchUserIds).map((id) => ({
        id,
        userName: `User_${id}`, // 테스트용 이름
        userPhone: process.env.TEST_PHONE || "", // 테스트용 전화번호
        userType: "all" as "all", // 정확한 타입 명시
        userTime: Timestamp.fromDate(new Date()), // 임의의 Timestamp
    }));    

    console.log("Filtered Users:", users);
    return users;
}

// 메시지 전송 작업 (테스트용)
async function sendMessagesTest(currentTime: Date, isMale: boolean): Promise<void> {
    const users = await getFilteredUsers(currentTime, isMale);
    const testPhone = process.env.TEST_PHONE;

    if (users.length === 0) {
        console.log("필터링된 유저가 없습니다.");
        return;
    }

    // 첫 번째 사용자에게 테스트 메시지 발송
    const firstUser = users[0];
    console.log("테스트 대상 유저:", firstUser);

    try {
        await sendSMS(
            testPhone!,
            `(광고) ${firstUser.userName}님, 테스트 메시지입니다. bit.ly/YP-DAY1`
        );
        console.log(`테스트 문자 발송 완료: ${testPhone}`);
    } catch (error) {
        console.error("테스트 문자 발송 실패:", error);
    }

    // 나머지 사용자 정보는 콘솔에 출력
    users.slice(1).forEach((user, index) => {
        console.log(`대상자 [${index + 2}]: ${JSON.stringify(user)}`);
    });
}

// main 함수 실행
async function main() {
    const currentTime = new Date();
    const isMale = true; // 남성 대상 여부

    // 필터링된 유저 가져오기 및 문자 테스트 전송
    const filteredUsers = await getFilteredUsers(currentTime, isMale);
    if (filteredUsers.length > 0) {
        await sendMessagesTest(currentTime, isMale);
    } else {
        console.log("필터링된 유저가 없습니다.");
    }
}

main().catch((error) => {
    console.error("메인 함수 실행 중 오류:", error);
});
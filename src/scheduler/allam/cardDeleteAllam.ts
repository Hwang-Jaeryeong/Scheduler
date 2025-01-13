import dotenv from "dotenv";
import crypto from "crypto";
import axios from "axios";
import db from "../../firebase/firebase";
import cron from "node-cron";
import { checkUserCards } from "./cardMessage";

dotenv.config();

const accessKey = process.env.SENS_ACCESS_KEY;
const secretKey = process.env.SENS_SECRET_KEY;
const serviceId = process.env.SENS_SERVICE_ID;
const testPhone = process.env.TEST_PHONE;
const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;

if (!accessKey || !secretKey || !serviceId || !testPhone) {
  throw new Error("환경 변수가 올바르게 설정되지 않았습니다.");
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
export async function sendSMS(phone: string, message: string): Promise<void> {
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

// 수락/거절 여부 확인
function hasAcceptedOrDeclined(matchRows: any[], gender: string): boolean {
  return matchRows.some((row) => row[`${gender}Check`] === 3 || row[`${gender}Check`] === 4);
}

// 호감 카드 여부를 확인하는 함수
async function checkFavoriteCards(
  matchRows: any[],
  partnerGender: string,
  type: "datingMatch" | "meetingMatch"
): Promise<boolean> {
  const firstViewField = type === "datingMatch" ? "datingMatchFirstView" : "meetingMatchFirstView";

  // 1. MatchCheck와 FirstView 조건에 맞는 rows를 필터링
  const favoriteRows = matchRows.filter(
    (row) => row[`${type}Check${partnerGender}`] === 3 && row[firstViewField] === 1
  );

  if (favoriteRows.length === 0) return false; // 조건에 맞는 row가 없다면 false 반환

  // 2. 각 row에서 partnerId를 가져와 user 컬렉션에서 포인트 확인
  for (const row of favoriteRows) {
    const partnerId = row[`${type}UserId${partnerGender}`]; // partner ID 추출

    // 3. user 컬렉션에서 pointBuy와 pointUse 값을 가져옴
    const userDoc = await db.collection("user").doc(partnerId).get();
    if (!userDoc.exists) continue; // 사용자 데이터가 없으면 건너뜀

    const userData = userDoc.data();
    const userPointBuy = userData?.userPointBuy || 0;
    const userPointUse = userData?.userPointUse || 0;

    // 4. 조건 검증: userPointBuy - userPointUse >= 400
    if (userPointBuy - userPointUse >= 400) {
      return true; // 조건 만족 시 호감 카드로 판단
    }
  }

  return false; // 모든 row가 조건을 만족하지 못한 경우
}


// 메시지 생성
function generateDeleteMessage(
  userName: string,
  isFavorite: boolean,
  hasAcceptedOrDeclined: boolean,
  hasReceivedCard: boolean
): string | null {
  if (isFavorite && !hasAcceptedOrDeclined) {
    return `(광고) ${userName}님, 호감 - 한 시간 뒤 어젯밤 프로필이 사라져요! 지금 확인하러 가요. bit.ly/YP-DAY1`;
  }

  if (!isFavorite && hasReceivedCard && !hasAcceptedOrDeclined) {
    return `(광고) ${userName}님, 일반 - 한 시간 뒤 어젯밤 프로필이 사라져요! 지금 확인하러 가요. bit.ly/YP-DAY1`;
  }

  return null;
}

// 실행 함수
async function executeCardDeleteAllam(handleDate: Date): Promise<void> {
  const users = await db.collection("user").get().then((snapshot) =>
    snapshot.docs.map((doc) => ({
      id: doc.id,
      userName: doc.data().userName,
      userPhone: doc.data().userPhone,
      userGender: doc.data().userGender,
    }))
  );

  const sentNumbers = new Set(); // 중복 방지
  let generalCardCount = 0;
  let favoriteCardCount = 0;

  for (const user of users) {
    if (sentNumbers.has(user.userPhone)) continue;

    const { meetingCards, datingCards } = await checkUserCards(user, handleDate);

    // `matchRows`를 올바르게 결합
    const matchRows = [...meetingCards, ...datingCards];
    if (matchRows.length === 0) continue; // 카드가 없으면 스킵

    const gender = user.userGender === 1 ? "Male" : "Female";
    const partnerGender = user.userGender === 1 ? "Female" : "Male";

    const acceptedOrDeclined = hasAcceptedOrDeclined(matchRows, gender);
    if (acceptedOrDeclined) continue;

    // 각각의 매칭 타입에 대해 `checkFavoriteCards` 호출
    const isFavoriteMeeting = await checkFavoriteCards(
      meetingCards,
      partnerGender,
      "meetingMatch"
    );

    const isFavoriteDating = await checkFavoriteCards(
      datingCards,
      partnerGender,
      "datingMatch"
    );

    // 둘 중 하나라도 true면 호감 카드로 판단
    const isFavorite = isFavoriteMeeting || isFavoriteDating;

    if (isFavorite) {
      favoriteCardCount++;
    } else {
      generalCardCount++;
    }

    const message = generateDeleteMessage(
      user.userName,
      isFavorite,
      acceptedOrDeclined,
      matchRows.length > 0 // `hasReceivedCard` 판단
    );

    if (message) {
      console.log(`Sending message to ${user.userPhone}: "${message}"`);
      // 실제 메시지 전송 코드
      // await sendSMS(user.userPhone, message);
      sentNumbers.add(user.userPhone);
    }
  }

  console.log(`총 일반 카드 발송: ${generalCardCount}명`);
  console.log(`총 호감 카드 발송: ${favoriteCardCount}명`);
}

// 스케줄러 설정
cron.schedule("50 15 * * *", () => {
  console.log("Executing Card Delete Alarm Scheduler...");
  executeCardDeleteAllam(new Date());
});

// cron.schedule("0 11 * * *", () => executeCardDeleteAllam(new Date()));
// cron.schedule("0 21 * * *", () => executeCardDeleteAllam(new Date()));
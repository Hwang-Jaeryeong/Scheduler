import dotenv from "dotenv";
import crypto from "crypto";
import axios from "axios";
import db from "../../firebase/firebase";
import cron from "node-cron";
import { checkUserCards } from "./cardMessage"; // 정확한 경로로 수정

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

  for (const user of users) {
    if (sentNumbers.has(user.userPhone)) continue;

    const { meetingCards, datingCards } = await checkUserCards(user, handleDate);

    if (!meetingCards.length && !datingCards.length) continue; // 카드가 없으면 스킵

    const message = "Some logic for generating message"; // 메시지 생성 로직 추가

    if (message) {
      console.log(`Sending message to ${user.userPhone}: "${message}"`);
      // await sendSMS(testPhone!, message);
      sentNumbers.add(user.userPhone);
    }
  }
}

// 스케줄러 설정
cron.schedule("10 16 * * *", () => {
  console.log("Executing Card Delete Alarm Scheduler...");
  executeCardDeleteAllam(new Date());
});
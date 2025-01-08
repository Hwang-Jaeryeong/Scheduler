import dotenv from "dotenv";
import crypto from "crypto";
import axios from "axios";

dotenv.config(); // .env 파일 로드

// Firebase DB 초기화
import db from "../../firebase/firebase";

// 네이버 SENS API 설정
const accessKey = process.env.SENS_ACCESS_KEY;
const secretKey = process.env.SENS_SECRET_KEY;
const serviceId = process.env.SENS_SERVICE_ID;

if (!accessKey || !secretKey || !serviceId) {
  throw new Error("환경 변수가 올바르게 설정되지 않았습니다.");
}

if (!process.env.SENDER_PHONE) {
  throw new Error("발신 번호(SENDER_PHONE)가 설정되지 않았습니다.");
}

if (!process.env.TEST_PHONE) {
  throw new Error("테스트 수신 번호(TEST_PHONE)가 설정되지 않았습니다.");
}

const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;

// 서명 생성 함수
function makeSignature(timestamp: string): string {
  const uri = `/sms/v2/services/${serviceId}/messages`;
  const message = `POST ${uri}\n${timestamp}\n${accessKey}`;
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
    console.log("SMS 요청 URL:", url);
    console.log("SMS 요청 헤더:", headers);
    console.log("SMS 요청 바디:", body);
    const response = await axios.post(url, body, { headers });
    console.log(`SMS 발송 성공: ${response.data.requestId}`);
  } catch (error: any) {
    console.error("SMS 요청 에러:", error.response?.data || error.message);
  }
}

// 신규 미설문자 처리 함수
async function handleNewIncompleteSurveys(): Promise<void> {
  try {
    const snapshot = await db
      .collection("user")
      .where("dating.datingGroup", "==", "D")
      .where("meeting.meetingGroup", "==", "D")
      .get();

    if (snapshot.empty) {
      console.log("미설문자 대상자가 없습니다.");
      return;
    }

    console.log(`[${snapshot.size}명] 미설문자 대상자 확인 완료`);

    let firstUserProcessed = false;

    snapshot.forEach(async (doc) => {
      const user = doc.data();
      const name = user.userName as string;
      const phone = process.env.TEST_PHONE || "";
      const message =
        "(광고) 아직 설문이 완료되지 않았어요! 설문을 완료하고 프로필을 완성해보세요 :)";

      console.log(`${name}님에게 메세지 발송을 완료하였습니다.`);
      console.log(`문자 발송 대상 핸드폰 번호: ${phone}`);

      if (!firstUserProcessed) {
        console.log(`[SMS 전송 테스트] ${name}님 (${phone}): 실제 문자 전송`);
        await sendSMS(phone, message);
        firstUserProcessed = true;
      }
    });
  } catch (error: any) {
    console.error("Firebase 쿼리 중 오류 발생:", error.message);
  }
}

// runSchedulerTask 함수 내보내기
export async function runSchedulerTask(): Promise<void> {
  console.log("[스케줄러] 신규 미설문자 처리 시작");
  await handleNewIncompleteSurveys();
  console.log("[스케줄러] 신규 미설문자 처리 완료");
}

// 스케줄러 설정
import cron from "node-cron";

cron.schedule("11 18 * * *", async () => {
  await runSchedulerTask();
});

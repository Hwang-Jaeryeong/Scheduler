import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const apiUrl = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";
const senderKey = process.env.KAKAO_SENDER_KEY;
const userId = process.env.KAKAO_USER_ID;
const templateCode = process.env.KAKAO_TEMPLATE_CODE;
const senderPhone = process.env.KAKAO_SENDER_PHONE;

if (!senderKey || !userId || !templateCode || !senderPhone) {
  throw new Error("Kakao Alimtalk 환경 변수가 설정되지 않았습니다.");
}

// 알림톡 전송 함수
export async function sendKakaoAlimtalk(
  phoneNumbers: string[],
  templateVariables: Record<string, string>
): Promise<void> {
  const headers = {
    "Content-Type": "application/json;charset=UTF-8",
    Authorization: `Bearer ${senderKey}`,
  };

  const recipientList = phoneNumbers.map((phone) => ({
    recipientNo: phone, // 수신자 전화번호
    templateParameter: templateVariables, // 템플릿 변수
    buttons: [
      {
        type: "WL", // 웹링크 타입
        name: "카드 확인", // 버튼 이름
        linkMo: "https://yeonpick.kr/matching", // 모바일 링크
        linkPc: "https://yeonpick.kr/matching", // PC 링크
      },
    ],
  }));

  const body = {
    recipientList,
    templateCode,
    userId,
    senderKey,
  };

  try {
    console.log("API 요청 본문:", JSON.stringify(body, null, 2));
    const response = await axios.post(apiUrl, body, { headers });
    console.log("알림톡 전송 성공:", response.data);
  } catch (error: any) {
    if (error.response) {
      console.error("알림톡 전송 실패 - 응답 에러:", error.response.data);
    } else if (error.request) {
      console.error("알림톡 전송 실패 - 요청 에러:", error.request);
    } else {
      console.error("알림톡 전송 실패 - 설정 에러:", error.message);
    }
  }
}

const templateVariables = {
    user_name: "황재령",
    type: "호감",
    deadline: "2025-01-31",
  };
  
  sendKakaoAlimtalk(["01041060607"], templateVariables);
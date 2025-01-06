const axios = require("axios"); // HTTP 요청을 위한 라이브러리
const dotenv = require("dotenv");

dotenv.config(); // .env 파일 로드

// 카카오톡 메시지 전송 테스트 함수
async function sendKakaoMessageTest() {
  try {
    const response = await axios.post(
      "https://kapi.kakao.com/v2/api/talk/memo/default/send", // 카카오톡 메시지 API URL
      {
        template_object: JSON.stringify({
          object_type: "text", // 메시지 유형
          text: "안녕하세요, 테스트 메시지입니다! 😊", // 보낼 메시지 내용
          link: {
            web_url: "https://example.com", // 클릭 시 열리는 URL
            mobile_web_url: "https://example.com",
          },
        }),
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${process.env.KAKAO_ACCESS_TOKEN}`, // .env에 저장된 Access Token
        },
      }
    );

    console.log("카카오톡 메시지 전송 성공:", response.data);
  } catch (error) {
    console.error("카카오톡 메시지 전송 실패:", error.response ? error.response.data : error.message);
  }
}

// 실행
sendKakaoMessageTest();

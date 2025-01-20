import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiUrl = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';
const apiKey = process.env.KAKAO_API_KEY;
const userId = process.env.KAKAO_USER_ID;
const senderKey = process.env.KAKAO_SENDER_KEY;
const templateCode = process.env.KAKAO_TEMPLATE_CODE;
const senderPhone = process.env.KAKAO_SENDER_PHONE;

if (!apiKey || !userId || !senderKey || !templateCode || !senderPhone) {
  throw new Error('필수 환경 변수가 설정되지 않았습니다.');
}

export async function sendKakaoAlimtalk(
  phoneNumbers: string[],
  templateVariables: Record<string, string>
): Promise<void> {
  console.log("sendKakaoAlimtalk called with:", phoneNumbers, templateVariables);
  const buttonData = [
    {
      name: '카드 확인', // 승인된 템플릿의 버튼 이름
      linkType: 'WL', // 웹 링크 타입
      linkTypeName: '웹링크', // 템플릿에 설정된 버튼 타입 이름
      linkMo: 'https://yeonpick.kr/matching', // 모바일 링크
      linkPc: 'https://yeonpick.kr/matching', // PC 링크
    },
  ];

  const recipients = phoneNumbers.map((phone, index) => ({
    receiver: phone,
    recvname: templateVariables.user_name || `수신자${index + 1}`,
    emtitle_1: '카드 도착 알림', // 승인된 템플릿의 타이틀
    message: `${templateVariables.user_name}님, 연픽 카드가 도착했어요!\n\n일상에 설렘을 더할 오늘의 인연이에요 :)\n${templateVariables.type} 카드를 확인해보시겠어요?\n\n- 카드는 ${templateVariables.deadline}까지 확인할 수 있어요\n- 한 번 놓친 카드는 다시 확인할 수 없어요\n- 꼭 수락/거절 의사를 밝혀주세요`,
    button: buttonData,
  }));

  const data = {
    apikey: apiKey!,
    userid: userId!,
    senderkey: senderKey!,
    tpl_code: templateCode!,
    sender: senderPhone!,
    receiver_1: recipients[0].receiver,
    recvname_1: recipients[0].recvname,
    message_1: recipients[0].message,
    button_1: JSON.stringify({ button: buttonData }), // 버튼 정보를 JSON으로 직렬화
    emtitle_1: '카드 도착 알림', // 타이틀 정보
    smsKind: 'S', // 대체 발송 문자 설정
    smsText: '(광고) 일상에 설렘을 더할 오늘의 인연이 도착했어요!\nhttps://yeonpick.kr/matching', // 대체 발송 문자 내용
  };

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  try {
    const response = await axios.post(apiUrl, new URLSearchParams(data), { headers });
    console.log('알림톡 전송 성공:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    if (error.response) {
      console.error('알림톡 전송 실패 - 응답 에러:', error.response.data);
    } else if (error.request) {
      console.error('알림톡 전송 실패 - 요청 에러:', error.request);
    } else {
      console.error('알림톡 전송 실패 - 설정 에러:', error.message);
    }
  }
}

// // 테스트 호출
// const templateVariables = {
//   user_name: '황재령',
//   type: '호감',
//   deadline: '2025-01-31',
// };

// sendKakaoAlimtalk(['+821041060607'], templateVariables);

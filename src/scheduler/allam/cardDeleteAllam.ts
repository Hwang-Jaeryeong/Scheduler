import dotenv from "dotenv";
import db from "../../firebase/firebase";
import cron from "node-cron";
import { checkUserCards } from "./cardMessage";
import { sendKakaoAlimtalk } from "../kakaoAlimtalk";
import { sendSMS } from "../sms"

dotenv.config();
const testPhone = process.env.TEST_PHONE;

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

    // const messageData = {
    //   userName: user.userName,
    //   handleDate: handleDate.toLocaleString(),
    // };

    // 알림톡 템플릿 변수 생성
    const templateVariables = {
      user_name: user.userName, // 사용자 이름
      type: isFavorite ? "호감" : "일반", // 카드 종류
      deadline: "2025-01-31", // 마감 기한 (예시)
    };

    try {
      // 카카오 알림톡 발송
      await sendKakaoAlimtalk([testPhone!], templateVariables);
      console.log(`Sending message to ${user.userPhone}: "${message}"`);
      console.log(`알림톡 전송 성공: ${user.userPhone}`);
      sentNumbers.add(user.userPhone);
    } catch (error) {
      console.error(`알림톡 전송 실패: ${user.userPhone}`, error);
    }

    if (message) {
      console.log(`Sending message to ${user.userPhone}: "${message}"`);
      // 메시지 전송 코드
      await sendSMS(testPhone!, message);
      sentNumbers.add(user.userPhone);
    }
  }

  console.log(`총 일반 카드 발송: ${generalCardCount}명`);
  console.log(`총 호감 카드 발송: ${favoriteCardCount}명`);
}

// 스케줄러 설정
cron.schedule("47 12 * * *", () => {
  console.log("Executing Card Delete Alarm Scheduler...");
  executeCardDeleteAllam(new Date());
});

// cron.schedule("0 11 * * *", () => executeCardDeleteAllam(new Date()));
// cron.schedule("0 21 * * *", () => executeCardDeleteAllam(new Date()));
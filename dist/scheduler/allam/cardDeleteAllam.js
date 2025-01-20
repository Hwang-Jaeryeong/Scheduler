"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCardDeleteAllam = executeCardDeleteAllam;
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
// import cron from "node-cron";
const cardMessage_1 = require("./cardMessage");
// import { sendKakaoAlimtalk } from "../kakaoAlimtalk";
// import { sendSMS } from "../sms"
dotenv_1.default.config();
// const testPhone = process.env.TEST_PHONE;
// 수락/거절 여부 확인
function hasAcceptedOrDeclined(matchRows, gender) {
    return matchRows.some((row) => row[`${gender}Check`] === 3 || row[`${gender}Check`] === 4);
}
// 호감 카드 여부를 확인하는 함수
function checkFavoriteCards(matchRows, partnerGender, type) {
    return __awaiter(this, void 0, void 0, function* () {
        const firstViewField = type === "datingMatch" ? "datingMatchFirstView" : "meetingMatchFirstView";
        // 1. MatchCheck와 FirstView 조건에 맞는 rows를 필터링
        const favoriteRows = matchRows.filter((row) => row[`${type}Check${partnerGender}`] === 3 && row[firstViewField] === 1);
        if (favoriteRows.length === 0)
            return false; // 조건에 맞는 row가 없다면 false 반환
        // 2. 각 row에서 partnerId를 가져와 user 컬렉션에서 포인트 확인
        for (const row of favoriteRows) {
            const partnerId = row[`${type}UserId${partnerGender}`]; // partner ID 추출
            // 3. user 컬렉션에서 pointBuy와 pointUse 값을 가져옴
            const userDoc = yield firebase_1.default.collection("user").doc(partnerId).get();
            if (!userDoc.exists)
                continue; // 사용자 데이터가 없으면 건너뜀
            const userData = userDoc.data();
            const userPointBuy = (userData === null || userData === void 0 ? void 0 : userData.userPointBuy) || 0;
            const userPointUse = (userData === null || userData === void 0 ? void 0 : userData.userPointUse) || 0;
            // 4. 조건 검증: userPointBuy - userPointUse >= 400
            if (userPointBuy - userPointUse >= 400) {
                return true; // 조건 만족 시 호감 카드로 판단
            }
        }
        return false; // 모든 row가 조건을 만족하지 못한 경우
    });
}
// // 메시지 생성
// function generateDeleteMessage(
//   userName: string,
//   isFavorite: boolean,
//   hasAcceptedOrDeclined: boolean,
//   hasReceivedCard: boolean
// ): string | null {
//   if (isFavorite && !hasAcceptedOrDeclined) {
//     return `(광고) ${userName}님, 호감 - 한 시간 뒤 어젯밤 프로필이 사라져요! 지금 확인하러 가요. bit.ly/YP-DAY1`;
//   }
//   if (!isFavorite && hasReceivedCard && !hasAcceptedOrDeclined) {
//     return `(광고) ${userName}님, 일반 - 한 시간 뒤 어젯밤 프로필이 사라져요! 지금 확인하러 가요. bit.ly/YP-DAY1`;
//   }
//   return null;
// }
// 실행 함수
function executeCardDeleteAllam(handleDate) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("card Delete Allam start");
        const logs = []; // 로그 저장 배열
        const users = yield firebase_1.default.collection("user").get().then((snapshot) => snapshot.docs.map((doc) => ({
            id: doc.id,
            userName: doc.data().userName,
            userPhone: doc.data().userPhone,
            userGender: doc.data().userGender,
        })));
        const sentNumbers = new Set(); // 중복 방지
        let generalCardCount = 0;
        let favoriteCardCount = 0;
        for (const user of users) {
            if (sentNumbers.has(user.userPhone))
                continue;
            const { meetingCards, datingCards } = yield (0, cardMessage_1.checkUserCards)(user, handleDate);
            const matchRows = [...meetingCards, ...datingCards];
            if (matchRows.length === 0)
                continue;
            const gender = user.userGender === 1 ? "Male" : "Female";
            const partnerGender = user.userGender === 1 ? "Female" : "Male";
            const acceptedOrDeclined = hasAcceptedOrDeclined(matchRows, gender);
            if (acceptedOrDeclined)
                continue;
            const isFavoriteMeeting = yield checkFavoriteCards(meetingCards, partnerGender, "meetingMatch");
            const isFavoriteDating = yield checkFavoriteCards(datingCards, partnerGender, "datingMatch");
            const isFavorite = isFavoriteMeeting || isFavoriteDating;
            // 카드 수신 여부 확인
            const hasReceivedCard = matchRows.length > 0;
            if (isFavorite && !acceptedOrDeclined) {
                favoriteCardCount++;
            }
            else if (!isFavorite && hasReceivedCard && !acceptedOrDeclined) {
                generalCardCount++;
            }
            // const message = generateDeleteMessage(
            //   user.userName,
            //   isFavorite,
            //   acceptedOrDeclined,
            //   hasReceivedCard
            // );
            // // type 값 설정 로직
            // let type: string;
            // if (isFavorite && !acceptedOrDeclined) {
            //   type = "호감";
            // } else if (!isFavorite && hasReceivedCard && !acceptedOrDeclined) {
            //   type = "일반";
            // } else {
            //   type = "기타"; // 기본값 설정 (조건이 없을 경우)
            // }
            // // templateVariables 생성
            // const templateVariables = {
            //   user_name: user.userName, // 사용자 이름
            //   type: type, // 조건에 따른 타입 설정
            //   deadline: "2025-01-31", // 마감 기한
            // };
            // // 카카오 알림톡
            // try {
            //   await sendKakaoAlimtalk([testPhone!], templateVariables);
            //   logs.push(`알림톡 전송 성공: ${user.userPhone}`);
            //   sentNumbers.add(user.userPhone);
            // } catch (error) {
            //   logs.push(`알림톡 전송 실패: ${user.userPhone}, Error: ${error}`);
            // }
            // 문자 전송
            // if (message) {
            //   // logs.push(`Sending SMS to ${user.userPhone}: "${message}"`);
            //   // await sendSMS(testPhone!, message);
            //   sentNumbers.add(user.userPhone);
            // }
        }
        logs.push(`총 일반 카드 발송: ${generalCardCount}명`);
        logs.push(`총 호감 카드 발송: ${favoriteCardCount}명`);
        return logs; // 로그 반환
    });
}
if (require.main === module) {
    executeCardDeleteAllam(new Date());
}
// // 스케줄러 설정
// cron.schedule("19 17 * * *", () => {
//   console.log("Executing Card Delete Alarm Scheduler...");
//   executeCardDeleteAllam(new Date());
// });
// cron.schedule("0 11 * * *", () => executeCardDeleteAllam(new Date()));
// cron.schedule("0 21 * * *", () => executeCardDeleteAllam(new Date()));

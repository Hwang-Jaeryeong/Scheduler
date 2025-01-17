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
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
// import cron from "node-cron";
const firestore_1 = require("firebase-admin/firestore");
// import { sendSMS } from "../sms"
dotenv_1.default.config();
// const testPhone = process.env.TEST_PHONE;
function calculateLastTime() {
    const times = [13, 23]; // 기준 타임 (13:00, 23:00)
    const now = firestore_1.Timestamp.now().toDate(); // Firebase Admin 서버의 현재 시간
    const lastTime = new Date(now);
    if (now.getHours() < times[0]) {
        lastTime.setDate(now.getDate() - 1); // 전날로 이동
        lastTime.setHours(times[1], 0, 0, 0); // 전날 23:00
    }
    else if (now.getHours() < times[1]) {
        lastTime.setHours(times[0], 0, 0, 0); // 오늘 13:00
    }
    else {
        lastTime.setHours(times[1], 0, 0, 0); // 오늘 23:00
    }
    return lastTime;
}
// function calculateTwoTimesAgo(lastTime: Date): Date {
//   const twoTimesAgo = new Date(lastTime);
//   if (lastTime.getHours() === 13) {
//     twoTimesAgo.setDate(lastTime.getDate() - 1); // 전날로 이동
//     twoTimesAgo.setHours(23); // 전날 23:00
//   } else {
//     twoTimesAgo.setHours(13); // 오늘 13:00
//   }
//   twoTimesAgo.setMinutes(0, 0, 0); // 분과 초를 초기화
//   return twoTimesAgo;
// }
function calculateThreeTimesAgo(lastTime) {
    const threeTimesAgo = new Date(lastTime);
    if (lastTime.getHours() === 13) {
        threeTimesAgo.setDate(lastTime.getDate() - 1); // 전날로 이동
        threeTimesAgo.setHours(13, 0, 0, 0); // 전날 13:00
    }
    else if (lastTime.getHours() === 23) {
        threeTimesAgo.setDate(lastTime.getDate() - 1); // 전날로 이동
        threeTimesAgo.setHours(23, 0, 0, 0); // 전날 23:00
    }
    return threeTimesAgo;
}
// 선결제 여부 확인 : 수정 필요
function checkPrepaid(userId, lastTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const threeTimesAgo = calculateThreeTimesAgo(lastTime);
        // 1분 전과 1분 후의 범위를 설정
        const startTime = new Date(threeTimesAgo);
        startTime.setMinutes(threeTimesAgo.getMinutes() - 1);
        const endTime = new Date(threeTimesAgo);
        endTime.setMinutes(threeTimesAgo.getMinutes() + 1);
        // 세 타임 전 row를 가져옴 (1분 전 ~ 1분 후 범위)
        const snapshots = yield Promise.all([
            firebase_1.default.collection("meetingMatch")
                .where("meetingMatchUserIdMale", "==", userId)
                .where("meetingMatchTime", ">=", firestore_1.Timestamp.fromDate(startTime))
                .where("meetingMatchTime", "<=", firestore_1.Timestamp.fromDate(endTime))
                .get(),
            firebase_1.default.collection("datingMatch")
                .where("datingMatchUserIdMale", "==", userId)
                .where("datingMatchTime", ">=", firestore_1.Timestamp.fromDate(startTime))
                .where("datingMatchTime", "<=", firestore_1.Timestamp.fromDate(endTime))
                .get(),
        ]);
        // 각 스냅샷에서 MatchPayMale === 3인 row가 하나라도 있는지 확인
        return snapshots.some((snapshot) => snapshot.docs.some((doc) => doc.data().meetingMatchPayMale == 3 || doc.data().datingMatchPayMale == 3));
    });
}
// 메시지 생성 함수
function generateProfileCouponMessage(isPrepaid, has400Picks) {
    if (isPrepaid) {
        return "(광고) 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
    }
    if (has400Picks) {
        // return "(광고) 400픽 보유 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
        return null;
    }
    return null;
}
// 실행 함수
function executeProfileCouponAlert() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("start");
        const lastTime = calculateLastTime();
        const users = yield firebase_1.default.collection("user")
            .where("userGender", "==", 1)
            .get()
            .then((snapshot) => snapshot.docs.map((doc) => {
            var _a, _b, _c, _d;
            return ({
                id: doc.id,
                userName: doc.data().userName,
                userPhone: doc.data().userPhone,
                userGender: doc.data().userGender,
                userPointBuy: doc.data().userPointBuy || 0,
                userPointUse: doc.data().userPointUse || 0,
                meetingIsOn: ((_a = doc.data().meeting) === null || _a === void 0 ? void 0 : _a.meetingIsOn) || false,
                meetingGroup: ((_b = doc.data().meeting) === null || _b === void 0 ? void 0 : _b.meetingGroup) || "",
                datingIsOn: ((_c = doc.data().dating) === null || _c === void 0 ? void 0 : _c.datingIsOn) || false,
                datingGroup: ((_d = doc.data().dating) === null || _d === void 0 ? void 0 : _d.datingGroup) || "",
            });
        }));
        const sentNumbers = new Set(); // 중복 방지
        let totalUsers = users.length;
        let prepaidUsersCount = 0;
        let picksUsersCount = 0;
        let activeUsersCount = 0;
        let messageSentCount = 0;
        for (const user of users) {
            if (sentNumbers.has(user.userPhone))
                continue;
            // 선결제 여부 확인
            const isPrepaid = yield checkPrepaid(user.id, lastTime);
            if (isPrepaid)
                prepaidUsersCount++;
            // 400픽 보유 여부 확인 (그 시각 기준)
            const has400Picks = user.userPointBuy - user.userPointUse >= 400;
            if (has400Picks)
                picksUsersCount++;
            // 활성화 여부 확인
            const isActive = (user.meetingIsOn && user.meetingGroup == "A") ||
                (user.datingIsOn && user.datingGroup == "A");
            if (isActive)
                activeUsersCount++;
            // 메시지 생성
            const message = generateProfileCouponMessage(isPrepaid, has400Picks && isActive);
            if (message) {
                // console.log(`Sending message to ${user.userPhone}: "${message}"`);
                // 실제 메시지 전송 코드
                // await sendSMS(testPhone!, message);
                sentNumbers.add(user.userPhone);
                messageSentCount++;
            }
        }
        console.log("===== 실행 통계 =====");
        console.log(`총 유저 수: ${totalUsers}`);
        console.log(`선결제 유저 수: ${prepaidUsersCount}`);
        console.log(`400픽 보유 유저 수: ${picksUsersCount}`);
        console.log(`활성화 유저 수: ${activeUsersCount}`);
        // console.log(`메시지 발송 유저 수: ${messageSentCount}`);
    });
}
executeProfileCouponAlert();
// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 13:00...");
//   executeProfileCouponAlert();
// });
// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 23:00...");
//   executeProfileCouponAlert();
// });

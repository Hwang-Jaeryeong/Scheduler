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
exports.calculateLastTime = calculateLastTime;
exports.calculateTwoTimesAgo = calculateTwoTimesAgo;
exports.chunkArray = chunkArray;
exports.executeProfileCouponAlert = executeProfileCouponAlert;
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
// import cron from "node-cron";
const firestore_1 = require("firebase-admin/firestore");
// import { sendSMS } from "../sms"
dotenv_1.default.config();
// const testPhone = process.env.TEST_PHONE;
// 기준 타임 계산 함수
function calculateLastTime(now) {
    const times = [13, 23];
    const lastTime = new Date(now);
    if (now.getHours() < times[0]) {
        lastTime.setDate(now.getDate() - 1);
        lastTime.setHours(times[1], 0, 0, 0);
    }
    else if (now.getHours() < times[1]) {
        lastTime.setHours(times[0], 0, 0, 0);
    }
    else {
        lastTime.setHours(times[1], 0, 0, 0);
    }
    return lastTime;
}
function calculateTwoTimesAgo(lastTime) {
    const twoTimesAgo = new Date(lastTime);
    if (lastTime.getHours() === 13) {
        twoTimesAgo.setDate(lastTime.getDate() - 1);
        twoTimesAgo.setHours(23);
    }
    else {
        twoTimesAgo.setHours(13);
    }
    twoTimesAgo.setMinutes(0, 0, 0);
    return twoTimesAgo;
}
// Firestore의 `IN` 제한(30개) 해결: 배열을 30개씩 나누는 함수
function chunkArray(array, size) {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}
// 실행 함수
function executeProfileCouponAlert(handleDate) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("profileCouponAlert start");
        const logs = [];
        logs.push("profileCouponAlert start");
        const now = handleDate ? new Date(handleDate) : firestore_1.Timestamp.now().toDate();
        const lastTime = new Date(now);
        lastTime.setHours(23, 0, 0, 0);
        const twoTimesAgo = new Date(lastTime);
        twoTimesAgo.setDate(lastTime.getDate() - 1);
        // Firestore에서 유저 데이터 가져오기 (한 번에!)
        const usersSnapshot = yield firebase_1.default.collection("user")
            .where("userGender", "==", 1)
            .select("userName", "userPhone", "userGender", "userPointBuy", "userPointUse", "meeting", "dating")
            .get();
        const users = usersSnapshot.docs.map(doc => {
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
        });
        const userIds = users.map(user => user.id);
        // 유저 ID를 30개씩 나누어서 Firestore에서 가져오기
        const userIdChunks = chunkArray(userIds, 30);
        let meetingMatches = [];
        let datingMatches = [];
        for (const chunk of userIdChunks) {
            const [meetingMatchSnapshot, datingMatchSnapshot] = yield Promise.all([
                firebase_1.default.collection("meetingMatch")
                    .where("meetingMatchUserIdMale", "in", chunk)
                    .where("meetingMatchTime", ">=", firestore_1.Timestamp.fromDate(twoTimesAgo))
                    .where("meetingMatchTime", "<=", firestore_1.Timestamp.fromDate(lastTime))
                    .select("meetingMatchUserIdMale", "meetingMatchPayMale")
                    .get(),
                firebase_1.default.collection("datingMatch")
                    .where("datingMatchUserIdMale", "in", chunk)
                    .where("datingMatchTime", ">=", firestore_1.Timestamp.fromDate(twoTimesAgo))
                    .where("datingMatchTime", "<=", firestore_1.Timestamp.fromDate(lastTime))
                    .select("datingMatchUserIdMale", "datingMatchPayMale")
                    .get(),
            ]);
            meetingMatches.push(...meetingMatchSnapshot.docs.map(doc => doc.data()));
            datingMatches.push(...datingMatchSnapshot.docs.map(doc => doc.data()));
        }
        // 유저 ID 기준으로 선결제 유저 목록 만들기
        const prepaidUsers = new Set();
        meetingMatches.forEach(doc => {
            if (doc.meetingMatchPayMale === 3)
                prepaidUsers.add(doc.meetingMatchUserIdMale);
        });
        datingMatches.forEach(doc => {
            if (doc.datingMatchPayMale === 3)
                prepaidUsers.add(doc.datingMatchUserIdMale);
        });
        // 메시지 전송할 유저 필터링
        const sentNumbers = new Set();
        let totalUsers = users.length;
        let prepaidUsersCount = 0;
        let picksUsersCount = 0;
        let activeUsersCount = 0;
        let messageSentCount = 0;
        for (const user of users) {
            if (sentNumbers.has(user.userPhone))
                continue;
            const isPrepaid = prepaidUsers.has(user.id);
            if (isPrepaid)
                prepaidUsersCount++;
            const has400Picks = user.userPointBuy - user.userPointUse >= 400;
            if (has400Picks)
                picksUsersCount++;
            const isActive = (user.meetingIsOn && user.meetingGroup === "A") ||
                (user.datingIsOn && user.datingGroup === "A");
            if (isActive)
                activeUsersCount++;
            // 메시지 생성 및 발송
            let message = null;
            if (isPrepaid) {
                message = "(광고) 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
            }
            if (message) {
                sentNumbers.add(user.userPhone);
                // logs.push(`Sending message to ${user.userPhone}: "${message}"`);
                // await sendSMS(testPhone!, message);
                messageSentCount++;
            }
        }
        logs.push("===== 실행 통계 =====");
        logs.push(`총 유저 수: ${totalUsers}`);
        logs.push(`선결제 유저 수: ${prepaidUsersCount}`);
        logs.push(`400픽 보유 유저 수: ${picksUsersCount}`);
        logs.push(`활성화 유저 수: ${activeUsersCount}`);
        return logs;
    });
}
if (require.main === module) {
    executeProfileCouponAlert();
}
// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 13:00...");
//   executeProfileCouponAlert();
// });
// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 23:00...");
//   executeProfileCouponAlert();
// });

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
// 선결제 여부 확인 함수
function checkPrepaid(userId, lastTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const twoTimesAgo = calculateTwoTimesAgo(lastTime);
        const startTime = new Date(twoTimesAgo);
        startTime.setMinutes(twoTimesAgo.getMinutes() - 1);
        const endTime = new Date(twoTimesAgo);
        endTime.setMinutes(twoTimesAgo.getMinutes() + 1);
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
        return snapshots.some((snapshot) => snapshot.docs.some((doc) => doc.data().meetingMatchPayMale == 3 ||
            doc.data().datingMatchPayMale == 3));
    });
}
// 메시지 생성 함수
function generateProfileCouponMessage(isPrepaid, has400Picks) {
    if (isPrepaid) {
        return "(광고) 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
    }
    if (has400Picks) {
        return null;
    }
    return null;
}
// 실행 함수
function executeProfileCouponAlert(handleDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const logs = [];
        console.log("profileCouponAlert start");
        logs.push("profileCouponAlert start");
        // 현재 시간 설정: 요청 바디에서 제공된 시간 또는 Firebase Admin의 시간 사용
        const now = handleDate ? new Date(handleDate) : firestore_1.Timestamp.now().toDate();
        const lastTime = calculateLastTime(now);
        const users = yield firebase_1.default.collection("user")
            .where("userGender", "==", 1)
            .get()
            .then((snapshot) => snapshot.docs.filter((doc) => {
            var _a, _b, _c, _d;
            const data = doc.data();
            const isDatingGroupA = ((_a = data.dating) === null || _a === void 0 ? void 0 : _a.datingGroup) === "A" && ((_b = data.dating) === null || _b === void 0 ? void 0 : _b.datingIsOn) === true;
            const isMeetingGroupA = ((_c = data.meeting) === null || _c === void 0 ? void 0 : _c.meetingGroup) === "A" && ((_d = data.meeting) === null || _d === void 0 ? void 0 : _d.meetingIsOn) === true;
            return isDatingGroupA || isMeetingGroupA; // 데이팅 또는 미팅 그룹이 A이면서 활성화된 유저
        }).map((doc) => {
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
        const sentNumbers = new Set();
        let totalUsers = users.length;
        let prepaidUsersCount = 0;
        let picksUsersCount = 0;
        let activeUsersCount = 0;
        let messageSentCount = 0;
        for (const user of users) {
            if (sentNumbers.has(user.userPhone))
                continue;
            const isPrepaid = yield checkPrepaid(user.id, lastTime);
            if (isPrepaid)
                prepaidUsersCount++;
            const has400Picks = user.userPointBuy - user.userPointUse >= 400;
            if (has400Picks)
                picksUsersCount++;
            const isActive = (user.meetingIsOn && user.meetingGroup === "A") ||
                (user.datingIsOn && user.datingGroup === "A");
            if (isActive)
                activeUsersCount++;
            const message = generateProfileCouponMessage(isPrepaid, has400Picks && isActive);
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

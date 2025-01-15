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
const node_cron_1 = __importDefault(require("node-cron"));
const firestore_1 = require("firebase-admin/firestore");
const sms_1 = require("../sms");
dotenv_1.default.config();
const testPhone = process.env.TEST_PHONE;
// 기준 타임 계산 함수 (그 시각 기준)
function calculateLastTime(now) {
    const times = [13, 23]; // 기준 타임 (13:00, 23:00)
    const lastTime = new Date(now);
    // 현재 시간을 기준으로 가장 가까운 이전 타임 계산
    if (now.getHours() < times[0]) {
        lastTime.setDate(now.getDate() - 1); // 전날 23:00
        lastTime.setHours(times[1], 0, 0, 0);
    }
    else if (now.getHours() < times[1]) {
        lastTime.setHours(times[0], 0, 0, 0); // 오늘 13:00
    }
    else {
        lastTime.setHours(times[1], 0, 0, 0); // 오늘 23:00
    }
    return lastTime;
}
// 선결제 여부 확인
function checkPrepaid(userId, lastTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const twoTimesAgo = new Date(lastTime);
        twoTimesAgo.setHours(lastTime.getHours() === 23 ? 13 : 23);
        if (lastTime.getHours() === 13) {
            twoTimesAgo.setDate(lastTime.getDate() - 1); // 전날로 변경
        }
        // 두 타임 전 row를 가져옴
        const snapshots = yield Promise.all([
            firebase_1.default.collection("meetingMatch")
                .where("meetingMatchUserIdMale", "==", userId)
                .where("meetingMatchTime", "==", firestore_1.Timestamp.fromDate(twoTimesAgo))
                .get(),
            firebase_1.default.collection("datingMatch")
                .where("datingMatchUserIdMale", "==", userId)
                .where("datingMatchTime", "==", firestore_1.Timestamp.fromDate(twoTimesAgo))
                .get(),
        ]);
        // 각 스냅샷에서 MatchPayMale === 3인 row가 하나라도 있는지 확인
        return snapshots.some((snapshot) => snapshot.docs.some((doc) => doc.data().meetingMatchPayMale === 3 || doc.data().datingMatchPayMale === 3));
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
        const now = firestore_1.Timestamp.now().toDate(); // Firebase 서버 시간 기준
        const lastTime = calculateLastTime(now); // 그 시각 계산
        const users = yield firebase_1.default.collection("user").get().then((snapshot) => snapshot.docs.map((doc) => {
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
            const isActive = (user.meetingIsOn && user.meetingGroup === "A") ||
                (user.datingIsOn && user.datingGroup === "A");
            if (isActive)
                activeUsersCount++;
            // 메시지 생성
            const message = generateProfileCouponMessage(isPrepaid, has400Picks && isActive);
            if (message) {
                console.log(`Sending message to ${user.userPhone}: "${message}"`);
                // 실제 메시지 전송 코드
                yield (0, sms_1.sendSMS)(testPhone, message);
                sentNumbers.add(user.userPhone);
                messageSentCount++;
            }
        }
        console.log("===== 실행 통계 =====");
        console.log(`총 유저 수: ${totalUsers}`);
        console.log(`선결제 유저 수: ${prepaidUsersCount}`);
        console.log(`400픽 보유 유저 수: ${picksUsersCount}`);
        console.log(`활성화 유저 수: ${activeUsersCount}`);
        console.log(`메시지 발송 유저 수: ${messageSentCount}`);
    });
}
// 스케줄러 (Test 용용)
node_cron_1.default.schedule("59 13 * * *", () => {
    console.log("Executing Card Delete Alarm Scheduler...");
    executeProfileCouponAlert();
});
// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 13:00...");
//   executeProfileCouponAlert();
// });
// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Profile Coupon Alert Scheduler at 23:00...");
//   executeProfileCouponAlert();
// });

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
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
const firestore_1 = require("firebase-admin/firestore");
const node_cron_1 = __importDefault(require("node-cron"));
dotenv_1.default.config();
const accessKey = process.env.SENS_ACCESS_KEY;
const secretKey = process.env.SENS_SECRET_KEY;
const serviceId = process.env.SENS_SERVICE_ID;
const testPhone = process.env.TEST_PHONE;
const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;
if (!accessKey || !secretKey || !serviceId || !testPhone) {
    throw new Error("환경 변수가 올바르게 설정되지 않았습니다.");
}
// 서명 생성 함수
function makeSignature(timestamp) {
    const method = "POST";
    const uri = `/sms/v2/services/${serviceId}/messages`;
    const message = `${method} ${uri}\n${timestamp}\n${accessKey}`;
    const hmac = crypto_1.default.createHmac("sha256", secretKey);
    hmac.update(message);
    return hmac.digest("base64");
}
// 문자 전송 함수
function sendSMS(phone, message) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
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
            const response = yield axios_1.default.post(url, body, { headers });
            console.log(`SMS 발송 성공: ${response.data.requestId}`);
        }
        catch (error) {
            console.error("SMS 요청 에러:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        }
    });
}
function fetchWithTimeout(promise, timeout) {
    return __awaiter(this, void 0, void 0, function* () {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore query timeout")), timeout)),
        ]);
    });
}
// 유저 필터링 함수 (최적화)
function getEligibleUsersOptimized(currentTime) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting Firestore queries...");
        const twoTimesAgo = firestore_1.Timestamp.fromDate(new Date(currentTime.getTime() - 14 * 60 * 60 * 1000));
        console.log("Fetching user collection...");
        const userSnapshot = yield firebase_1.default.collection("user")
            .select("id", "userGender", "userPointBuy", "userPointUse", "dating.datingGroup", "dating.datingIsOn", "meeting.meetingGroup", "meeting.meetingIsOn")
            .get();
        console.log("User collection fetched. Count:", userSnapshot.size);
        console.log("Fetching datingMatch collection...");
        const datingMatchSnapshot = yield fetchWithTimeout(firebase_1.default.collection("datingMatch")
            .where("datingMatchPayMale", "==", 3)
            .where("datingMatchTime", ">=", twoTimesAgo)
            .limit(1000) // 필요 시 limit 추가
            .get(), 10000 // 타임아웃 10초
        );
        console.log("DatingMatch collection fetched. Count:", datingMatchSnapshot.size);
        console.log("Fetching meetingMatch collection...");
        const meetingMatchSnapshot = yield firebase_1.default.collection("meetingMatch")
            .where("meetingMatchPayMale", "==", 3)
            .where("meetingMatchTime", ">=", twoTimesAgo)
            .get();
        console.log("MeetingMatch collection fetched. Count:", meetingMatchSnapshot.size);
        const userData = userSnapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        const prepaidUserIds = new Set([
            ...datingMatchSnapshot.docs.map((doc) => doc.data().userId),
            ...meetingMatchSnapshot.docs.map((doc) => doc.data().userId),
        ]);
        const users = userData
            .map((user) => {
            const points = (user.userPointBuy || 0) - (user.userPointUse || 0);
            const isActive = ["dating", "meeting"].some((type) => user[`${type}.${type}Group`] === "A" && user[`${type}.${type}IsOn`] === true);
            const isPrepaid = prepaidUserIds.has(user.id);
            if (isPrepaid || (points >= 400 && isActive)) {
                return {
                    id: user.id,
                    userName: user.userName || `User_${user.id}`,
                    userPhone: user.userPhone || "NoPhone",
                    userGender: user.userGender || 0,
                    userPointBuy: user.userPointBuy || 0,
                    userPointUse: user.userPointUse || 0,
                    userStatus: isActive,
                    isPrepaid: isPrepaid,
                };
            }
            return null;
        })
            .filter((user) => user !== null);
        console.log(`Eligible users count: ${users.length}`);
        return users;
    });
}
// 메시지 발송 작업 (최적화)
function sendNotificationsOptimized() {
    return __awaiter(this, void 0, void 0, function* () {
        const currentTime = new Date();
        const users = yield getEligibleUsersOptimized(currentTime);
        if (users.length === 0) {
            console.log("메시지 발송 대상 유저가 없습니다.");
            return;
        }
        const firstUser = users[0];
        const message = firstUser.isPrepaid
            ? `(광고) ${firstUser.userName}님, 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!`
            : `(광고) ${firstUser.userName}님, 400픽 보유 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!`;
        console.log(`[1] ${firstUser.userName}: "${message}"`);
        yield sendSMS(testPhone, message);
        users.slice(1).forEach((user, index) => {
            const userMessage = user.isPrepaid
                ? `(광고) ${user.userName}님, 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!`
                : `(광고) ${user.userName}님, 400픽 보유 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!`;
            console.log(`[${index + 2}] ${user.userName}: "${userMessage}"`);
        });
    });
}
// 스케줄러 설정
node_cron_1.default.schedule("32 17 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("메시지 전송 시작");
    yield sendNotificationsOptimized();
    console.log("메시지 전송 완료");
}));

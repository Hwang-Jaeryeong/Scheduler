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
const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;
if (!accessKey || !secretKey || !serviceId) {
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
// 유저 필터링 함수
function getEligibleUsers(currentTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = [];
        const twoTimesAgo = firestore_1.Timestamp.fromDate(new Date(currentTime.getTime() - 14 * 60 * 60 * 1000));
        // Firestore에서 user 데이터를 가져오기
        const userSnapshot = yield firebase_1.default.collection("user").get();
        const userData = userSnapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        for (const user of userData) {
            // 남자 여부 확인
            if (user.userGender !== 1)
                continue;
            // 선결제 여부 확인
            const datingMatchSnapshot = yield firebase_1.default.collection("datingMatch")
                .where("userId", "==", user.id)
                .where("datingMatchPayMale", "==", 3)
                .where("datingMatchTime", ">=", twoTimesAgo)
                .get();
            const meetingMatchSnapshot = yield firebase_1.default.collection("meetingMatch")
                .where("userId", "==", user.id)
                .where("meetingMatchPayMale", "==", 3)
                .where("meetingMatchTime", ">=", twoTimesAgo)
                .get();
            const isPrepaid = !datingMatchSnapshot.empty || !meetingMatchSnapshot.empty;
            // 400픽 보유 여부 확인
            const points = (user.userPointBuy || 0) - (user.userPointUse || 0);
            // 활성화 여부 확인
            const isActive = ["dating", "meeting"].some((type) => user[`${type}.${type}Group`] === "A" && user[`${type}.${type}IsOn`] === true);
            // 조건에 맞는 유저만 추가
            if (isPrepaid || (points >= 400 && isActive)) {
                users.push({
                    id: user.id,
                    userName: user.userName || `User_${user.id}`, // 기본값
                    userPhone: user.userPhone || "NoPhone", // 기본값
                    userGender: user.userGender,
                    userPointBuy: user.userPointBuy || 0,
                    userPointUse: user.userPointUse || 0,
                    userStatus: isActive,
                    isPrepaid: isPrepaid,
                });
            }
        }
        return users;
    });
}
// 메시지 발송 작업
function sendNotifications() {
    return __awaiter(this, void 0, void 0, function* () {
        const currentTime = new Date();
        const users = yield getEligibleUsers(currentTime);
        for (const user of users) {
            const message = user.isPrepaid
                ? "(광고) 매칭 성사 완료! 선결제 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!"
                : "(광고) 400픽 보유 혜택으로, 추가프로필 무료 쿠폰을 지급 받았어요!";
            console.log(`메시지 발송 대상: ${user.userName} (${user.userPhone})`);
            yield sendSMS(user.userPhone, message);
        }
    });
}
// 스케줄러 설정
node_cron_1.default.schedule("0 13 * * *", sendNotifications); // 매일 13:00 실행
node_cron_1.default.schedule("0 23 * * *", sendNotifications); // 매일 23:00 실행

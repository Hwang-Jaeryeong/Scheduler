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
// import cron from "node-cron";
dotenv_1.default.config(); // .env 파일 로드
// 네이버 SENS API 설정
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
// 카드 수신 여부 확인 함수
function getReceivedCards(currentTime) {
    return __awaiter(this, void 0, void 0, function* () {
        // const users: User[] = [];
        const today13 = firestore_1.Timestamp.fromDate(new Date(currentTime.setHours(13, 0, 0, 0)));
        const yesterday23 = firestore_1.Timestamp.fromDate(new Date(currentTime.getTime() - 14 * 60 * 60 * 1000));
        // Firestore에서 match 데이터 가져오기
        console.log("Fetching datingMatch and meetingMatch collections...");
        const [datingSnapshot, meetingSnapshot] = yield Promise.all([
            firebase_1.default.collection("datingMatch")
                .where("datingMatchTime", "in", [yesterday23, today13])
                .get(),
            firebase_1.default.collection("meetingMatch")
                .where("meetingMatchTime", "in", [yesterday23, today13])
                .get(),
        ]);
        console.log("Collections fetched:", {
            datingCount: datingSnapshot.size,
            meetingCount: meetingSnapshot.size,
        });
        const allMatchDocs = [...datingSnapshot.docs, ...meetingSnapshot.docs];
        const userMap = new Map();
        allMatchDocs.forEach((doc) => {
            var _a;
            const data = doc.data();
            const userId = data.userId;
            const matchType = data.type === "meeting" ? "meeting" : "dating";
            if (!userMap.has(userId)) {
                userMap.set(userId, {
                    id: userId,
                    userName: `User_${userId}`,
                    userPhone: process.env.TEST_PHONE || "",
                    receivedCards: new Set(),
                });
            }
            (_a = userMap.get(userId)) === null || _a === void 0 ? void 0 : _a.receivedCards.add(matchType);
        });
        console.log("Filtered Users with Cards:", Array.from(userMap.values()));
        return Array.from(userMap.values());
    });
}
// 메시지 전송 작업
function sendMessagesTest(currentTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield getReceivedCards(currentTime);
        if (users.length === 0) {
            console.log("필터링된 유저가 없습니다.");
            return;
        }
        const firstUser = users[0];
        let message = "(광고)[소개팅 / 미팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1";
        if (firstUser.receivedCards.size === 1) {
            if (firstUser.receivedCards.has("meeting")) {
                message = "(광고)[미팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1";
            }
            else {
                message = "(광고)[소개팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1";
            }
        }
        console.log(`[1] ${firstUser.userName}: "${message}"`);
        yield sendSMS(firstUser.userPhone, message);
        users.slice(1).forEach((user, index) => {
            let userMessage = "(광고)[소개팅 / 미팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1";
            if (user.receivedCards.size === 1) {
                if (user.receivedCards.has("meeting")) {
                    userMessage = "(광고)[미팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1";
                }
                else {
                    userMessage = "(광고)[소개팅] 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1";
                }
            }
            console.log(`[${index + 2}] ${user.userName}: "${userMessage}"`);
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const currentTime = new Date();
        yield sendMessagesTest(currentTime);
    });
}
main().catch((error) => {
    console.error("메인 함수 실행 중 오류:", error);
});

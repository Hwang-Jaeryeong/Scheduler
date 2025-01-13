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
exports.sendSMS = sendSMS;
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
const node_cron_1 = __importDefault(require("node-cron"));
const cardMessage_1 = require("./cardMessage"); // 정확한 경로로 수정
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
// 실행 함수
function executeCardDeleteAllam(handleDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield firebase_1.default.collection("user").get().then((snapshot) => snapshot.docs.map((doc) => ({
            id: doc.id,
            userName: doc.data().userName,
            userPhone: doc.data().userPhone,
            userGender: doc.data().userGender,
        })));
        const sentNumbers = new Set(); // 중복 방지
        for (const user of users) {
            if (sentNumbers.has(user.userPhone))
                continue;
            const { meetingCards, datingCards } = yield (0, cardMessage_1.checkUserCards)(user, handleDate);
            if (!meetingCards.length && !datingCards.length)
                continue; // 카드가 없으면 스킵
            const message = "Some logic for generating message"; // 메시지 생성 로직 추가
            if (message) {
                console.log(`Sending message to ${user.userPhone}: "${message}"`);
                // await sendSMS(testPhone!, message);
                sentNumbers.add(user.userPhone);
            }
        }
    });
}
// 스케줄러 설정
node_cron_1.default.schedule("10 16 * * *", () => {
    console.log("Executing Card Delete Alarm Scheduler...");
    executeCardDeleteAllam(new Date());
});

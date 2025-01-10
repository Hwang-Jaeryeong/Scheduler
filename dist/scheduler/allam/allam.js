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
exports.runSchedulerTask = runSchedulerTask;
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
dotenv_1.default.config(); // .env 파일 로드
// Firebase DB 초기화
const firebase_1 = __importDefault(require("../../firebase/firebase"));
// 네이버 SENS API 설정
const accessKey = process.env.SENS_ACCESS_KEY;
const secretKey = process.env.SENS_SECRET_KEY;
const serviceId = process.env.SENS_SERVICE_ID;
if (!accessKey || !secretKey || !serviceId) {
    throw new Error("환경 변수가 올바르게 설정되지 않았습니다.");
}
if (!process.env.SENDER_PHONE) {
    throw new Error("발신 번호(SENDER_PHONE)가 설정되지 않았습니다.");
}
if (!process.env.TEST_PHONE) {
    throw new Error("테스트 수신 번호(TEST_PHONE)가 설정되지 않았습니다.");
}
const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;
// 서명 생성 함수
function makeSignature(timestamp) {
    const uri = `/sms/v2/services/${serviceId}/messages`;
    const message = `POST ${uri}\n${timestamp}\n${accessKey}`;
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
            console.log("SMS 요청 URL:", url);
            console.log("SMS 요청 헤더:", headers);
            console.log("SMS 요청 바디:", body);
            const response = yield axios_1.default.post(url, body, { headers });
            console.log(`SMS 발송 성공: ${response.data.requestId}`);
        }
        catch (error) {
            console.error("SMS 요청 에러:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        }
    });
}
// 신규 미설문자 처리 함수
function handleNewIncompleteSurveys() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const snapshot = yield firebase_1.default
                .collection("user")
                .where("dating.datingGroup", "==", "D")
                .where("meeting.meetingGroup", "==", "D")
                .get();
            if (snapshot.empty) {
                console.log("미설문자 대상자가 없습니다.");
                return;
            }
            console.log(`[${snapshot.size}명] 미설문자 대상자 확인 완료`);
            let firstUserProcessed = false; // 첫 번째 사용자 처리 여부
            // QuerySnapshot을 배열로 변환하여 forEach 대신 for-of 사용
            const docs = snapshot.docs;
            for (let index = 0; index < docs.length; index++) {
                const doc = docs[index];
                const user = doc.data();
                const name = user.userName;
                const phone = process.env.TEST_PHONE || "";
                const message = `(광고) ${name}님, 아직 설문이 완료되지 않았어요! 설문을 완료하고 프로필을 완성해보세요 :)`;
                if (!firstUserProcessed) {
                    // 첫 번째 사용자에게만 SMS 전송
                    console.log(`[SMS 전송 테스트] ${name}님 (${phone}): 실제 문자 전송`);
                    yield sendSMS(phone, message);
                    firstUserProcessed = true;
                }
                else {
                    // 나머지 사용자 정보는 콘솔에 출력
                    console.log(`대상자 [${index + 1}]: ${JSON.stringify(user)}`);
                }
            }
        }
        catch (error) {
            console.error("Firebase 쿼리 중 오류 발생:", error.message);
        }
    });
}
// runSchedulerTask 함수 내보내기
function runSchedulerTask() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("[스케줄러] 신규 미설문자 처리 시작");
        yield handleNewIncompleteSurveys();
        console.log("[스케줄러] 신규 미설문자 처리 완료");
    });
}
// 스케줄러 설정
const node_cron_1 = __importDefault(require("node-cron"));
node_cron_1.default.schedule("25 14 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    yield runSchedulerTask();
}));

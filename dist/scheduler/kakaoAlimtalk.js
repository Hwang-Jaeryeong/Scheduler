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
exports.sendKakaoAlimtalk = sendKakaoAlimtalk;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiUrl = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";
const senderKey = process.env.KAKAO_SENDER_KEY;
const userId = process.env.KAKAO_USER_ID;
const templateCode = process.env.KAKAO_TEMPLATE_CODE;
const senderPhone = process.env.KAKAO_SENDER_PHONE;
if (!senderKey || !userId || !templateCode || !senderPhone) {
    throw new Error("Kakao Alimtalk 환경 변수가 설정되지 않았습니다.");
}
// 알림톡 전송 함수
function sendKakaoAlimtalk(phoneNumbers, templateVariables) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            "Content-Type": "application/json;charset=UTF-8",
            Authorization: `Bearer ${senderKey}`,
        };
        const recipientList = phoneNumbers.map((phone) => ({
            recipientNo: phone, // 수신자 전화번호
            templateParameter: templateVariables, // 템플릿 변수
            buttons: [
                {
                    type: "WL", // 웹링크 타입
                    name: "카드 확인", // 버튼 이름
                    linkMo: "https://yeonpick.kr/matching", // 모바일 링크
                    linkPc: "https://yeonpick.kr/matching", // PC 링크
                },
            ],
        }));
        const body = {
            recipientList,
            templateCode,
            userId,
            senderKey,
        };
        try {
            console.log("API 요청 본문:", JSON.stringify(body, null, 2));
            const response = yield axios_1.default.post(apiUrl, body, { headers });
            console.log("알림톡 전송 성공:", response.data);
        }
        catch (error) {
            if (error.response) {
                console.error("알림톡 전송 실패 - 응답 에러:", error.response.data);
            }
            else if (error.request) {
                console.error("알림톡 전송 실패 - 요청 에러:", error.request);
            }
            else {
                console.error("알림톡 전송 실패 - 설정 에러:", error.message);
            }
        }
    });
}
const templateVariables = {
    user_name: "황재령",
    type: "호감",
    deadline: "2025-01-31",
};
sendKakaoAlimtalk(["01041060607"], templateVariables);

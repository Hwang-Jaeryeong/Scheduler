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
const node_cron_1 = __importDefault(require("node-cron"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
const sms_1 = require("../sms");
dotenv_1.default.config(); // .env 파일 로드
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
                    yield (0, sms_1.sendSMS)(phone, message);
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
node_cron_1.default.schedule("25 14 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    yield runSchedulerTask();
}));

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
// import cron from "node-cron";
const firebase_1 = __importDefault(require("../../firebase/firebase"));
const sms_1 = require("../sms");
dotenv_1.default.config();
// 신규 미설문자 처리 함수
function handleNewIncompleteSurveys() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // A, B, C에 해당 안되는 ....?
            const datingSnapshot = yield firebase_1.default
                .collection("user")
                .where("dating.datingGroup", "not-in", ["A", "B", "C"])
                .get();
            const meetingSnapshot = yield firebase_1.default
                .collection("user")
                .where("meeting.meetingGroup", "not-in", ["A", "B", "C"])
                .get();
            const uniqueUsers = new Map();
            datingSnapshot.forEach((doc) => uniqueUsers.set(doc.id, doc.data()));
            meetingSnapshot.forEach((doc) => uniqueUsers.set(doc.id, doc.data()));
            const users = Array.from(uniqueUsers.values());
            // 대상자가 없을 경우 로깅 후 종료
            if (users.length === 0) {
                console.log("필터링된 대상자가 없습니다.");
                return;
            }
            console.log(`[${users.length}명] 필터링되지 않은 대상자 확인 완료`);
            let firstUserProcessed = false; // 첫 번째 사용자 처리 여부
            for (let index = 0; index < users.length; index++) {
                const user = users[index];
                const name = user.userName;
                // 테스트를 위한 전화번호 또는 실제 전화번호
                // const phone = process.env.TEST_PHONE || user.phoneNumber || "";
                const phone = process.env.TEST_PHONE || "";
                if (!phone) {
                    console.warn(`대상자 [${index + 1}]의 전화번호가 없습니다: ${JSON.stringify(user)}`);
                    continue; // 전화번호가 없으면 다음 사용자로 넘어감
                }
                const message = `(광고) ${name}님, 아직 설문이 완료되지 않았어요! 설문을 완료하고 프로필을 완성해보세요 :)`;
                if (!firstUserProcessed) {
                    // 첫 번째 사용자에게만 SMS 전송
                    console.log(`[SMS 전송 테스트] ${name}님 (${phone}): 실제 문자 전송`);
                    yield (0, sms_1.sendSMS)(phone, message);
                    firstUserProcessed = true;
                }
                else {
                    // 나머지 사용자 정보는 콘솔에 출력
                    // console.log(`대상자 [${index + 1}]: ${JSON.stringify(user.userPhone)}`);
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
if (require.main === module) {
    runSchedulerTask();
}
// cron.schedule("20 15 * * *", async () => {
//   await runSchedulerTask();
// });

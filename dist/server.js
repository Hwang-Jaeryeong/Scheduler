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
const express_1 = __importDefault(require("express"));
const cardMessage_1 = require("./scheduler/allam/cardMessage");
const cardDeleteAllam_1 = require("./scheduler/allam/cardDeleteAllam");
const postpayer_1 = require("./scheduler/allam/postpayer");
const profileCouponAlert_1 = require("./scheduler/allam/profileCouponAlert");
const activeUser_1 = require("./scheduler/activeUser");
// import cron from "node-cron";
const app = (0, express_1.default)();
const port = 3000;
// ✅ JSON 요청 처리 미들웨어
app.use(express_1.default.json());
// ✅ 로그 저장 배열
const logs = [];
// ✅ 로그를 저장하는 함수
function logToConsole(message) {
    console.log(message);
    logs.push(message);
}
// ✅ 기본 엔드포인트
app.get("/", (_, res) => {
    res.send("Hello, World! Express 서버가 정상적으로 실행 중입니다.");
});
// ✅ POST /card-message
app.post("/card-message", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    logs.length = 0;
    try {
        logToConsole("POST /card-message 요청 수신");
        yield (0, cardMessage_1.extractAndSendMessages)(logToConsole);
        res.status(200).send({
            success: true,
            message: "cardMessage 실행 완료",
            logs,
        });
    }
    catch (error) {
        console.error("❌ cardMessage 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "cardMessage 실행 중 에러 발생", error: error.message });
    }
}));
// ✅ POST /card-delete-allam
app.post("/card-delete-allam", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const handleDate = req.body.handleDate ? new Date(req.body.handleDate) : new Date();
        const logs = yield (0, cardDeleteAllam_1.executeCardDeleteAllam)(handleDate);
        res.status(200).send({
            success: true,
            message: "executeCardDeleteAllam 실행 완료",
            logs,
        });
    }
    catch (error) {
        console.error("❌ executeCardDeleteAllam 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "executeCardDeleteAllam 실행 중 에러 발생", error: error.message });
    }
}));
// ✅ POST /postpayer
app.post("/postpayer", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    logs.length = 0;
    try {
        logToConsole("POST /postpayer 요청 수신");
        const postpaidLogs = yield (0, postpayer_1.executePostpaidAlert)();
        logs.push(...postpaidLogs);
        res.status(200).send({
            success: true,
            message: "executePostpaidAlert 실행 완료",
            logs,
        });
    }
    catch (error) {
        console.error("❌ executePostpaidAlert 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "executePostpaidAlert 실행 중 에러 발생", error: error.message });
    }
}));
// ✅ POST /profile-coupon-alert
app.post("/profile-coupon-alert", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const logs = [];
    try {
        logToConsole("POST /profile-coupon-alert 요청 수신");
        const handleDate = req.body.handleDate ? new Date(req.body.handleDate) : undefined;
        const couponAlertLogs = yield (0, profileCouponAlert_1.executeProfileCouponAlert)(handleDate);
        logs.push(...couponAlertLogs);
        res.status(200).send({
            success: true,
            message: "executeProfileCouponAlert 실행 완료",
            logs,
        });
    }
    catch (error) {
        console.error("❌ executeProfileCouponAlert 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "executeProfileCouponAlert 실행 중 에러 발생", error: error.message });
    }
}));
// ✅ GET /active-user-check
app.get("/active-user-check", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("GET /active-user-check 요청 수신");
        // handleDate를 쿼리 파라미터로 받거나 기본값으로 현재 시간 설정
        const handleDate = req.query.handleDate
            ? new Date(req.query.handleDate)
            : new Date(); // 기본값: 현재 시간
        // 🔹 전체 활성화 유저 수 + 잘못 활성화된 유저 가져오기
        const { incorrectUsers, totalActiveUsers } = yield (0, activeUser_1.findIncorrectlyActivatedUsers)(handleDate);
        // ✅ 응답 최상단에 "총 활성화 유저 수" 추가
        res.status(200).send({
            success: true,
            message: "활성화 유저 검사 완료",
            총_활성화_유저: totalActiveUsers, // 🔹 추가됨!
            logs: [
                `총 ${incorrectUsers.length}명의 잘못 활성화된 유저를 확인했습니다.`,
                ...incorrectUsers.map((user, index) => `#${index + 1} - 이름: ${user.userName}, 전화번호: ${user.userPhone}, ` +
                    `데이트 그룹: ${user.datingGroup}, 미팅 그룹: ${user.meetingGroup}, ` +
                    `이벤트 시간: ${user.eventTime}, userLastAccessTime: ${user.userLastAccessTime}`)
            ]
        });
    }
    catch (error) {
        console.error("❌ 활성화 유저 검사 중 에러:", error);
        res.status(500).send({
            success: false,
            message: "활성화 유저 검사 중 에러 발생",
            error: error.message,
        });
    }
}));
// ✅ 잘못된 유저 수정 (POST)
app.post("/active-user-update", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("POST /active-user-update 요청 수신");
        const handleDate = req.body.handleDate
            ? new Date(req.body.handleDate)
            : new Date();
        const updatedUsers = yield (0, activeUser_1.updateIncorrectlyActivatedUsers)(handleDate);
        res.status(200).send({
            success: true,
            message: "잘못 활성화된 유저 수정 완료",
            updatedUsers,
        });
    }
    catch (error) {
        console.error("❌ 활성화 유저 수정 중 에러:", error);
        res.status(500).send({
            success: false,
            message: "활성화 유저 수정 중 에러 발생",
            error: error.message,
        });
    }
}));
// // ✅ 스케줄러 추가 (예시로 매일 오전 9시?)
// cron.schedule("0 9 * * *", async () => {
//     console.log("[스케줄러] 매일 오전 9시: 활성화된 유저 자동 수정 시작");
//     try {
//         await updateIncorrectlyActivatedUsers();
//         console.log("✅ [스케줄러] 잘못 활성화된 유저 자동 수정 완료");
//     } catch (error) {
//         console.error("❌ [스케줄러] 활성화 유저 수정 중 에러 발생:", error);
//     }
// }, {
//     timezone: "Asia/Seoul" // KST 기준
// });
// 서버 실행
app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
});

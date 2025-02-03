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
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const path_1 = __importDefault(require("path"));
const cardMessage_1 = require("./scheduler/allam/cardMessage");
const cardDeleteAllam_1 = require("./scheduler/allam/cardDeleteAllam");
const postpayer_1 = require("./scheduler/allam/postpayer");
const profileCouponAlert_1 = require("./scheduler/allam/profileCouponAlert");
const app = (0, express_1.default)();
const port = 3000;
// ✅ Firebase 초기화
const firebaseKeyPath = path_1.default.join(__dirname, "firebase-key.json");
try {
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert(firebaseKeyPath),
        databaseURL: "https://your-project-id.firebaseio.com", // 🔥 프로젝트 ID 수정 필요
    });
    console.log("✅ Firebase Admin SDK Initialized");
}
catch (error) {
    console.error("🔥 Firebase Admin SDK Initialization Failed:", error);
}
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
// ✅ 서버 실행
app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
});

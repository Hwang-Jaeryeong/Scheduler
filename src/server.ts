import express from "express";
import admin from "firebase-admin";
import path from "path";
import { extractAndSendMessages } from "./scheduler/allam/cardMessage";
import { executeCardDeleteAllam } from "./scheduler/allam/cardDeleteAllam";
import { executePostpaidAlert } from "./scheduler/allam/postpayer";
import { executeProfileCouponAlert } from "./scheduler/allam/profileCouponAlert";

const app = express();
const port = 3000;

// ✅ Firebase 초기화
const firebaseKeyPath = path.join(__dirname, "firebase-key.json");

try {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseKeyPath),
        databaseURL: "https://your-project-id.firebaseio.com", // 🔥 프로젝트 ID 수정 필요
    });
    console.log("✅ Firebase Admin SDK Initialized");
} catch (error) {
    console.error("🔥 Firebase Admin SDK Initialization Failed:", error);
}

// ✅ JSON 요청 처리 미들웨어
app.use(express.json());

// ✅ 로그 저장 배열
const logs: string[] = [];

// ✅ 로그를 저장하는 함수
function logToConsole(message: string) {
    console.log(message);
    logs.push(message);
}

// ✅ 기본 엔드포인트
app.get("/", (_, res) => {
    res.send("Hello, World! Express 서버가 정상적으로 실행 중입니다.");
});

// ✅ POST /card-message
app.post("/card-message", async (_, res) => {
    logs.length = 0;

    try {
        logToConsole("POST /card-message 요청 수신");
        await extractAndSendMessages(logToConsole);

        res.status(200).send({
            success: true,
            message: "cardMessage 실행 완료",
            logs,
        });
    } catch (error) {
        console.error("❌ cardMessage 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "cardMessage 실행 중 에러 발생", error: (error as Error).message });
    }
});

// ✅ POST /card-delete-allam
app.post("/card-delete-allam", async (req, res) => {
    try {
        const handleDate = req.body.handleDate ? new Date(req.body.handleDate) : new Date();
        const logs = await executeCardDeleteAllam(handleDate);

        res.status(200).send({
            success: true,
            message: "executeCardDeleteAllam 실행 완료",
            logs,
        });
    } catch (error) {
        console.error("❌ executeCardDeleteAllam 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "executeCardDeleteAllam 실행 중 에러 발생", error: (error as Error).message });
    }
});

// ✅ POST /postpayer
app.post("/postpayer", async (_, res) => {
    logs.length = 0;

    try {
        logToConsole("POST /postpayer 요청 수신");
        const postpaidLogs = await executePostpaidAlert();
        logs.push(...postpaidLogs);

        res.status(200).send({
            success: true,
            message: "executePostpaidAlert 실행 완료",
            logs,
        });
    } catch (error) {
        console.error("❌ executePostpaidAlert 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "executePostpaidAlert 실행 중 에러 발생", error: (error as Error).message });
    }
});

// ✅ POST /profile-coupon-alert
app.post("/profile-coupon-alert", async (req, res) => {
    const logs: string[] = [];

    try {
        logToConsole("POST /profile-coupon-alert 요청 수신");
        const handleDate = req.body.handleDate ? new Date(req.body.handleDate) : undefined;
        const couponAlertLogs = await executeProfileCouponAlert(handleDate);
        logs.push(...couponAlertLogs);

        res.status(200).send({
            success: true,
            message: "executeProfileCouponAlert 실행 완료",
            logs,
        });
    } catch (error) {
        console.error("❌ executeProfileCouponAlert 실행 중 에러:", error);
        res.status(500).send({ success: false, message: "executeProfileCouponAlert 실행 중 에러 발생", error: (error as Error).message });
    }
});

// ✅ 서버 실행
app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
});
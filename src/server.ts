import express from "express";
import { extractAndSendMessages } from "./scheduler/allam/cardMessage";
import { executeCardDeleteAllam } from "./scheduler/allam/cardDeleteAllam";
import { executePostpaidAlert } from "./scheduler/allam/postpayer";
import { executeProfileCouponAlert } from "./scheduler/allam/profileCouponAlert";
import { findIncorrectlyActivatedUsers, updateIncorrectlyActivatedUsers } from "./scheduler/activeUser";
// import cron from "node-cron";

const app = express();
const port = 3000;


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

// ✅ GET /active-user-check
app.get("/active-user-check", async (req, res) => {

    try {
        console.log("GET /active-user-check 요청 수신");

        // handleDate를 쿼리 파라미터로 받거나 기본값으로 현재 시간 설정
        const handleDate = req.query.handleDate
            ? new Date(req.query.handleDate as string)
            : new Date(); // 기본값: 현재 시간

        // 🔹 전체 활성화 유저 수 + 잘못 활성화된 유저 가져오기
        const { incorrectUsers, totalActiveUsers } = await findIncorrectlyActivatedUsers(handleDate);

        // ✅ 응답 최상단에 "총 활성화 유저 수" 추가
        res.status(200).send({
            success: true,
            message: "활성화 유저 검사 완료",
            총_활성화_유저: totalActiveUsers, // 🔹 추가됨!
            logs: [
                `총 ${incorrectUsers.length}명의 잘못 활성화된 유저를 확인했습니다.`,
                ...incorrectUsers.map((user, index) =>
                    `#${index + 1} - 이름: ${user.userName}, 전화번호: ${user.userPhone}, ` +
                    `데이트 그룹: ${user.datingGroup}, 미팅 그룹: ${user.meetingGroup}, ` +
                    `이벤트 시간: ${user.eventTime}, userLastAccessTime: ${user.userLastAccessTime}`
                )
            ]
        });
    } catch (error) {
        console.error("❌ 활성화 유저 검사 중 에러:", error);
        res.status(500).send({
            success: false,
            message: "활성화 유저 검사 중 에러 발생",
            error: (error as Error).message,
        });
    }
});


// ✅ 잘못된 유저 수정 (POST)
app.post("/active-user-update", async (req, res) => {
    try {
        console.log("POST /active-user-update 요청 수신");

        const handleDate = req.body.handleDate
            ? new Date(req.body.handleDate as string)
            : new Date();

        const updatedUsers = await updateIncorrectlyActivatedUsers(handleDate);

        res.status(200).send({
            success: true,
            message: "잘못 활성화된 유저 수정 완료",
            updatedUsers,
        });
    } catch (error) {
        console.error("❌ 활성화 유저 수정 중 에러:", error);
        res.status(500).send({
            success: false,
            message: "활성화 유저 수정 중 에러 발생",
            error: (error as Error).message,
        });
    }
});

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
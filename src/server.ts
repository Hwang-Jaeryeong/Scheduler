import express from "express";
import { extractAndSendMessages } from "./scheduler/allam/cardMessage";
import { executeCardDeleteAllam } from "./scheduler/allam/cardDeleteAllam";
import { executePostpaidAlert } from "./scheduler/allam/postpayer";
import { executeProfileCouponAlert } from "./scheduler/allam/profileCouponAlert";

const app = express();
const port = 3000;

// JSON 요청 처리 미들웨어
app.use(express.json());

// 로그 저장 배열
const logs: string[] = [];

// 로그를 저장하는 함수로 대체
function logToConsole(message: string) {
    console.log(message);
    logs.push(message);
}
app.get('/', (req, res) => {
  res.send('Hello, World! Express 서버가 정상적으로 실행 중입니다.');
});


// POST /card-message
app.post("/card-message", async (_, res) => {
    logs.length = 0; // 이전 요청 로그 초기화

    try {
        logToConsole("POST /card-message 요청 수신");

        // cardMessage.ts의 함수 실행
        await extractAndSendMessages(logToConsole);

        // 성공 메시지와 로그 응답
        res.status(200).send({
            success: true,
            message: "cardMessage 실행 완료",
            logs: logs,
        });
    } catch (error: unknown) {
        const err = error as Error; // error를 Error 타입으로 단언
        console.error(`cardMessage 실행 중 에러: ${err.message}`);
    }    
});

// POST /card-delete-allam
app.post("/card-delete-allam", async (req, res) => {
    try {
      const handleDate = req.body.handleDate ? new Date(req.body.handleDate) : new Date();
  
      // cardDeleteAllam 실행
      const logs = await executeCardDeleteAllam(handleDate);
  
      res.status(200).send({
        success: true,
        message: "executeCardDeleteAllam 실행 완료",
        logs: logs,
      });
    } catch (error: any) {
      console.error(`executeCardDeleteAllam 실행 중 에러: ${error.message}`);
      res.status(500).send({
        success: false,
        message: "executeCardDeleteAllam 실행 중 에러 발생",
        error: error.message,
      });
    }
  });

// POST /postpayer
app.post("/postpayer", async (_, res) => {
  logs.length = 0; // 이전 요청 로그 초기화

  try {
      logToConsole("POST /postpayer 요청 수신");

      // postpayer.ts의 함수 실행 및 로그 추가
      const postpaidLogs = await executePostpaidAlert();
      logs.push(...postpaidLogs);

      // 성공 메시지와 로그 응답
      res.status(200).send({
          success: true,
          message: "executePostpaidAlert 실행 완료",
          logs: logs, // 로그 반환
      });
  } catch (error: unknown) {
      const err = error as Error; // error를 Error 타입으로 단언
      console.error(`executePostpaidAlert 실행 중 에러: ${err.message}`);
      res.status(500).send({
          success: false,
          message: "executePostpaidAlert 실행 중 에러 발생",
          error: err.message,
      });
  }
});

  
// POST /profile-coupon-alert
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
      logs: logs,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).send({
      success: false,
      message: "executeProfileCouponAlert 실행 중 에러 발생",
      error: err.message,
    });
  }
});


// 서버 실행
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

import express from "express";
import { extractAndSendMessages } from "./scheduler/allam/cardMessage";

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

  

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

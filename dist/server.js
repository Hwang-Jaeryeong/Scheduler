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
const app = (0, express_1.default)();
const port = 3000;
// JSON 요청 처리 미들웨어
app.use(express_1.default.json());
// 로그 저장 배열
const logs = [];
// 로그를 저장하는 함수로 대체
function logToConsole(message) {
    console.log(message);
    logs.push(message);
}
// POST /card-message
app.post("/card-message", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    logs.length = 0; // 이전 요청 로그 초기화
    try {
        logToConsole("POST /card-message 요청 수신");
        // cardMessage.ts의 함수 실행
        yield (0, cardMessage_1.extractAndSendMessages)(logToConsole);
        // 성공 메시지와 로그 응답
        res.status(200).send({
            success: true,
            message: "cardMessage 실행 완료",
            logs: logs,
        });
    }
    catch (error) {
        const err = error; // error를 Error 타입으로 단언
        console.error(`cardMessage 실행 중 에러: ${err.message}`);
    }
}));
// POST /card-delete-allam
app.post("/card-delete-allam", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const handleDate = req.body.handleDate ? new Date(req.body.handleDate) : new Date();
        // cardDeleteAllam 실행
        const logs = yield (0, cardDeleteAllam_1.executeCardDeleteAllam)(handleDate);
        res.status(200).send({
            success: true,
            message: "executeCardDeleteAllam 실행 완료",
            logs: logs,
        });
    }
    catch (error) {
        console.error(`executeCardDeleteAllam 실행 중 에러: ${error.message}`);
        res.status(500).send({
            success: false,
            message: "executeCardDeleteAllam 실행 중 에러 발생",
            error: error.message,
        });
    }
}));
// 서버 실행
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

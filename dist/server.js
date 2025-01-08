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
const dotenv_1 = __importDefault(require("dotenv"));
const allam_1 = require("scheduler/allam/allam");
dotenv_1.default.config(); // .env 파일 로드
const app = (0, express_1.default)();
// /allam 경로 - 수동 스케줄러 실행
app.get("/allam", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, allam_1.runSchedulerTask)(); // 스케줄러 작업 실행
        res.send("스케줄러 작업이 성공적으로 실행되었습니다.");
    }
    catch (error) {
        console.error("스케줄러 실행 중 오류 발생:", error);
        res.status(500).send("스케줄러 실행 실패");
    }
}));
// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 실행되었습니다. http://localhost:${PORT}`);
});

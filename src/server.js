const express = require("express");
const dotenv = require("dotenv");
const { runSchedulerTask } = require("./scheduler/allam");

dotenv.config(); // .env 로드드
const app = express();

// /allam 경로 - 수동 스케줄러 실행
app.get("/allam", async (req, res) => {
  try {
    await runSchedulerTask(); // 스케줄러 작업 실행
    res.send("스케줄러 작업이 성공적으로 실행되었습니다.");
  } catch (error) {
    console.error("스케줄러 실행 중 오류 발생:", error);
    res.status(500).send("스케줄러 실행 실패");
  }
});

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 실행되었습니다. http://localhost:${PORT}`);
});

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
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
// import cron from "node-cron";
const firestore_1 = require("firebase-admin/firestore");
// import { sendSMS } from "../sms"
dotenv_1.default.config();
// const testPhone = process.env.TEST_PHONE;
// 기준 타임 계산 함수
function calculateLastTime(now) {
    const times = [13, 23];
    const lastTime = new Date(now);
    if (now.getHours() < times[0]) {
        lastTime.setDate(now.getDate() - 1);
        lastTime.setHours(times[1], 0, 0, 0);
    }
    else if (now.getHours() < times[1]) {
        lastTime.setHours(times[0], 0, 0, 0);
    }
    else {
        lastTime.setHours(times[1], 0, 0, 0);
    }
    return lastTime;
}
function calculateTwoTimesAgo(lastTime) {
    const twoTimesAgo = new Date(lastTime);
    if (lastTime.getHours() === 13) {
        twoTimesAgo.setDate(lastTime.getDate() - 1);
        twoTimesAgo.setHours(23, 0, 0, 0);
    }
    else {
        twoTimesAgo.setHours(13, 0, 0, 0);
    }
    return twoTimesAgo;
}
// 후결제 여부 확인
function checkPostpaid(userId, lastTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const twoTimesAgo = calculateTwoTimesAgo(lastTime);
        const snapshots = yield Promise.all([
            firebase_1.default.collection("meetingMatch")
                .where("meetingMatchUserIdMale", "==", userId)
                .where("meetingMatchTime", "==", firestore_1.Timestamp.fromDate(twoTimesAgo))
                .get(),
            firebase_1.default.collection("datingMatch")
                .where("datingMatchUserIdMale", "==", userId)
                .where("datingMatchTime", "==", firestore_1.Timestamp.fromDate(twoTimesAgo))
                .get(),
        ]);
        let isGeneral = false;
        let isFemalePrepaid = false;
        snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.meetingMatchPayMale === 1 || data.datingMatchPayMale === 1) {
                    if (data.meetingMatchCheckMale === 3 && data.meetingMatchCheckFemale === 3) {
                        if (data.meetingMatchFirstView === 1)
                            isGeneral = true;
                        if (data.meetingMatchFirstView === 2)
                            isFemalePrepaid = true;
                    }
                }
            });
        });
        return { isGeneral, isFemalePrepaid };
    });
}
// 메시지 생성 함수
function generatePostpaidMessage(isFemalePrepaid, isGeneral) {
    if (isFemalePrepaid) {
        return "(광고) 상대가 먼저 호감을 보냈어요! 오늘 밤 10시까지 연락처를 확인하세요! bit.ly/YP-DAY1";
    }
    if (isGeneral) {
        return "(광고) 매칭 성사 완료! 오늘 밤 10시까지 연락처를 확인하세요! bit.ly/YP-DAY1";
    }
    return null;
}
// 실행 함수
function executePostpaidAlert() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("start");
        const now = firestore_1.Timestamp.now().toDate();
        const lastTime = calculateLastTime(now);
        const users = yield firebase_1.default.collection("user")
            .where("userGender", "==", 1) // 남자 유저만 필터링
            .get()
            .then((snapshot) => snapshot.docs.map((doc) => ({
            id: doc.id,
            userName: doc.data().userName,
            userPhone: doc.data().userPhone,
            userGender: doc.data().userGender,
        })));
        const sentNumbers = new Set();
        let totalMaleUsers = 0;
        let generalPostpaidCount = 0;
        let femalePrepaidCount = 0;
        for (const user of users) {
            totalMaleUsers++; // 전체 남자 유저 카운트
            if (sentNumbers.has(user.userPhone))
                continue;
            const { isGeneral, isFemalePrepaid } = yield checkPostpaid(user.id, lastTime);
            if (isGeneral)
                generalPostpaidCount++; // 일반 후결제 카운트 증가
            if (isFemalePrepaid)
                femalePrepaidCount++; // 여성 선매칭 후결제 카운트 증가
            const message = generatePostpaidMessage(isFemalePrepaid, isGeneral);
            if (message) {
                // console.log(`Sending message to ${user.userPhone}: "${message}"`);
                // await sendSMS(testPhone!, message);
                // await sendSMS(user.userPhone, message);
                sentNumbers.add(user.userPhone);
            }
        }
        // 통계 정보 출력
        console.log("===== 실행 통계 =====");
        console.log(`전체 남자 유저 수: ${totalMaleUsers}`);
        console.log(`일반 후결제 유저 수: ${generalPostpaidCount}`);
        console.log(`여성 선매칭 후결제 유저 수: ${femalePrepaidCount}`);
    });
}
executePostpaidAlert();
// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Postpaid Alert Scheduler at 13:00...");
//   executePostpaidAlert();
// });
// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Postpaid Alert Scheduler at 23:00...");
//   executePostpaidAlert();
// });

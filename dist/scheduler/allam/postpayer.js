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
exports.executePostpaidAlert = executePostpaidAlert;
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
    if (lastTime.getHours() == 13) {
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
        // 1분 전과 1분 후의 범위
        const startTime = new Date(twoTimesAgo);
        startTime.setMinutes(twoTimesAgo.getMinutes() - 1);
        const endTime = new Date(twoTimesAgo);
        endTime.setMinutes(twoTimesAgo.getMinutes() + 1);
        const [meetingSnapshots, datingSnapshots] = yield Promise.all([
            firebase_1.default.collection("meetingMatch")
                .where("meetingMatchUserIdMale", "==", userId)
                .where("meetingMatchTime", ">=", firestore_1.Timestamp.fromDate(startTime))
                .where("meetingMatchTime", "<=", firestore_1.Timestamp.fromDate(endTime))
                .select("meetingMatchFirstView", "meetingMatchCheckMale", "meetingMatchCheckFemale", "meetingMatchPayMale")
                .get(),
            firebase_1.default.collection("datingMatch")
                .where("datingMatchUserIdMale", "==", userId)
                .where("datingMatchTime", ">=", firestore_1.Timestamp.fromDate(startTime))
                .where("datingMatchTime", "<=", firestore_1.Timestamp.fromDate(endTime))
                .select("datingMatchFirstView", "datingMatchCheckMale", "datingMatchCheckFemale", "datingMatchPayMale")
                .get()
        ]);
        let isGeneral = false;
        let isFemalePrepaid = false;
        // meetingMatch 처리
        meetingSnapshots.docs.forEach((doc) => {
            const data = doc.data();
            if (data.meetingMatchPayMale === 1 &&
                data.meetingMatchCheckMale === 3 &&
                data.meetingMatchCheckFemale === 3) {
                if (data.meetingMatchFirstView === 1)
                    isGeneral = true;
                if (data.meetingMatchFirstView === 2)
                    isFemalePrepaid = true;
            }
        });
        // datingMatch 처리
        datingSnapshots.docs.forEach((doc) => {
            const data = doc.data();
            if (data.datingMatchPayMale === 1 &&
                data.datingMatchCheckMale === 3 &&
                data.datingMatchCheckFemale === 3) {
                if (data.datingMatchFirstView === 1)
                    isGeneral = true;
                if (data.datingMatchFirstView === 2)
                    isFemalePrepaid = true;
            }
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
        const logs = [];
        logs.push("postpayer start");
        const now = firestore_1.Timestamp.now().toDate();
        const lastTime = calculateLastTime(now);
        const users = yield firebase_1.default.collection("user")
            .where("userGender", "==", 1)
            .get()
            .then((snapshot) => snapshot.docs.filter(doc => {
            var _a, _b, _c, _d;
            const data = doc.data();
            const isDatingGroupA = ((_a = data.dating) === null || _a === void 0 ? void 0 : _a.datingGroup) == "A" && ((_b = data.dating) === null || _b === void 0 ? void 0 : _b.datingIsOn) == true;
            const isMeetingGroupA = ((_c = data.meeting) === null || _c === void 0 ? void 0 : _c.meetingGroup) == "A" && ((_d = data.meeting) === null || _d === void 0 ? void 0 : _d.meetingIsOn) == true;
            return isDatingGroupA || isMeetingGroupA;
        }).map((doc) => ({
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
            totalMaleUsers++;
            if (sentNumbers.has(user.userPhone))
                continue;
            const { isGeneral, isFemalePrepaid } = yield checkPostpaid(user.id, lastTime);
            if (isGeneral)
                generalPostpaidCount++;
            if (isFemalePrepaid)
                femalePrepaidCount++;
            const message = generatePostpaidMessage(isFemalePrepaid, isGeneral);
            if (message) {
                // logs.push(`Sending message to ${user.userPhone}: "${message}"`);
                // await sendSMS(testPhone!, message);
                sentNumbers.add(user.userPhone);
            }
        }
        logs.push("===== 실행 통계 =====");
        logs.push(`전체 남자 유저 수: ${totalMaleUsers}`);
        logs.push(`일반 후결제 유저 수: ${generalPostpaidCount}`);
        logs.push(`여성 선매칭 후결제 유저 수: ${femalePrepaidCount}`);
        return logs;
    });
}
if (require.main === module) {
    executePostpaidAlert();
}
// // 스케줄러 설정
// cron.schedule("0 13 * * *", () => {
//   console.log("Executing Postpaid Alert Scheduler at 13:00...");
//   executePostpaidAlert();
// });
// cron.schedule("0 23 * * *", () => {
//   console.log("Executing Postpaid Alert Scheduler at 23:00...");
//   executePostpaidAlert();
// });

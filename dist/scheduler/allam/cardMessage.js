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
exports.checkUserCards = checkUserCards;
exports.extractAndSendMessages = extractAndSendMessages;
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_1 = __importDefault(require("../../firebase/firebase"));
const firestore_1 = require("firebase-admin/firestore");
// import cron from "node-cron";
const sms_1 = require("../sms");
dotenv_1.default.config();
const testPhone = process.env.TEST_PHONE;
// 일주일 간 가입한 사용자 추출
function getRecentUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        const oneWeekAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const snapshot = yield firebase_1.default.collection("user").where("userTime", ">=", oneWeekAgo).get();
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            userName: doc.data().userName || `User_${doc.id}`,
            userPhone: doc.data().userPhone || "NoPhone",
            userGender: doc.data().userGender,
        }));
    });
}
// 사용자 카드 확인
function checkUserCards(user, handleDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const meetingCards = [];
        const datingCards = [];
        let maleMatchTime, femaleMatchTime;
        if (handleDate.getHours() >= 23) {
            maleMatchTime = new Date(handleDate.setHours(23, 0, 0, 0));
            femaleMatchTime = new Date(handleDate.setHours(13, 0, 0, 0) - 24 * 60 * 60 * 1000);
        }
        else if (handleDate.getHours() >= 13) {
            maleMatchTime = new Date(handleDate.setHours(13, 0, 0, 0));
            femaleMatchTime = new Date(handleDate.setHours(23, 0, 0, 0) - 24 * 60 * 60 * 1000);
        }
        else {
            maleMatchTime = new Date(handleDate.setHours(23, 0, 0, 0) - 24 * 60 * 60 * 1000);
            femaleMatchTime = new Date(handleDate.setHours(13, 0, 0, 0) - 24 * 60 * 60 * 1000);
        }
        if (user.userGender === 1) {
            const meetingSnapshot = yield firebase_1.default.collection("meetingMatch")
                .where("meetingMatchUserIdMale", "==", user.id)
                .where("meetingMatchTime", "==", firestore_1.Timestamp.fromDate(maleMatchTime))
                .get();
            const datingSnapshot = yield firebase_1.default.collection("datingMatch")
                .where("datingMatchUserIdMale", "==", user.id)
                .where("datingMatchTime", "==", firestore_1.Timestamp.fromDate(maleMatchTime))
                .get();
            meetingCards.push(...meetingSnapshot.docs.map((doc) => doc.data()));
            datingCards.push(...datingSnapshot.docs.map((doc) => doc.data()));
        }
        else {
            const meetingSnapshot = yield firebase_1.default.collection("meetingMatch")
                .where("meetingMatchUserIdFemale", "==", user.id)
                .where("meetingMatchTime", "==", firestore_1.Timestamp.fromDate(femaleMatchTime))
                .get();
            const datingSnapshot = yield firebase_1.default.collection("datingMatch")
                .where("datingMatchUserIdFemale", "==", user.id)
                .where("datingMatchTime", "==", firestore_1.Timestamp.fromDate(femaleMatchTime))
                .get();
            meetingCards.push(...meetingSnapshot.docs.map((doc) => doc.data()));
            datingCards.push(...datingSnapshot.docs.map((doc) => doc.data()));
        }
        return { meetingCards, datingCards };
    });
}
// 메시지 추출 및 발송 작업
function extractAndSendMessages(log) {
    return __awaiter(this, void 0, void 0, function* () {
        log("extractAndSendMessages 실행 시작");
        const handleDate = new Date();
        const users = yield getRecentUsers();
        const eligibleUsers = [];
        for (const user of users) {
            // checkUserCards 함수 호출
            const { meetingCards, datingCards } = yield checkUserCards(user, handleDate);
            // meetingCount와 datingCount 계산
            const meetingCount = meetingCards.length;
            const datingCount = datingCards.length;
            log(`User: ${user.userPhone}, ${user.userName}, meetingCard: ${meetingCount}, datingCard: ${datingCount}`);
            if (meetingCount > 0 || datingCount > 0) {
                eligibleUsers.push(Object.assign(Object.assign({}, user), { meetingCount, datingCount }));
            }
        }
        if (eligibleUsers.length === 0) {
            log("발송 대상자가 없습니다.");
            return;
        }
        const firstUser = eligibleUsers[0];
        const message = firstUser.meetingCount > 0 && firstUser.datingCount > 0
            ? `(광고) [미팅 / 소개팅] ${firstUser.userName}님, 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1`
            : firstUser.meetingCount > 0
                ? `(광고) [미팅] ${firstUser.userName}님, 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1`
                : `(광고) [소개팅] ${firstUser.userName}님, 일상에 설렘을 더할 오늘의 인연이 도착했어요! bit.ly/YP-DAY1`;
        log(`[TEST] Sending message to: ${firstUser.userPhone}, Content: "${message}"`);
        yield (0, sms_1.sendSMS)(testPhone, message);
    });
}
if (require.main === module) {
    const log = (message) => console.log(message); // 로그 함수 정의
    extractAndSendMessages(log);
}
// cron.schedule("15 13 * * *", extractAndSendMessages); // 오후 1시 15분
// cron.schedule("15 23 * * *", extractAndSendMessages); // 오후 11시 15분

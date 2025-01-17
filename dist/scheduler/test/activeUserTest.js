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
const firebase_1 = __importDefault(require("../../firebase/firebase"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        // 첫 번째 조건 쿼리
        const meetingQuery = yield firebase_1.default.collection("user")
            .where("userGender", "==", 1)
            .where("meeting.meetingIsOn", "==", true)
            .where("meeting.meetingGroup", "==", "A")
            .get();
        // 두 번째 조건 쿼리
        const datingQuery = yield firebase_1.default.collection("user")
            .where("userGender", "==", 1)
            .where("dating.datingIsOn", "==", true)
            .where("dating.datingGroup", "==", "A")
            .get();
        // 두 결과를 합치면서 중복 제거
        const uniqueUsers = new Map();
        meetingQuery.forEach((doc) => {
            uniqueUsers.set(doc.id, doc.data());
        });
        datingQuery.forEach((doc) => {
            uniqueUsers.set(doc.id, doc.data());
        });
        // 최종 결과 출력
        console.log("Active user count:", uniqueUsers.size);
        return uniqueUsers;
    });
}
run();

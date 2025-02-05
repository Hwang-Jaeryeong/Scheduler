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
exports.findIncorrectlyActivatedUsers = findIncorrectlyActivatedUsers;
exports.updateIncorrectlyActivatedUsers = updateIncorrectlyActivatedUsers;
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_1 = __importDefault(require("../firebase/firebase"));
const firestore_1 = require("firebase-admin/firestore");
dotenv_1.default.config();
// 잘못 활성화된 유저 조회
function findIncorrectlyActivatedUsers(handleDate) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const currentTime = handleDate ? firestore_1.Timestamp.fromDate(handleDate) : firestore_1.Timestamp.now();
        const incorrectUsers = [];
        // 🔹 Firestore에서 활성화된 유저 조회
        const activeUsersQuery = firebase_1.default.collection("user")
            .where("userGender", "in", [1, 2])
            .get();
        const activeUsersSnapshot = yield activeUsersQuery;
        // 🔹 중복 제거를 위한 `Map` 사용
        const uniqueUsers = new Map();
        activeUsersSnapshot.docs.forEach((doc) => {
            var _a, _b, _c, _d;
            const userData = doc.data();
            const userId = doc.id;
            const userGender = userData.userGender;
            if (userGender !== 1 && userGender !== 2)
                return;
            const datingGroup = ((_a = userData.dating) === null || _a === void 0 ? void 0 : _a.datingGroup) || null;
            const meetingGroup = ((_b = userData.meeting) === null || _b === void 0 ? void 0 : _b.meetingGroup) || null;
            const isActiveUser = (datingGroup === "A" && ((_c = userData.dating) === null || _c === void 0 ? void 0 : _c.datingIsOn) === true) ||
                (meetingGroup === "A" && ((_d = userData.meeting) === null || _d === void 0 ? void 0 : _d.meetingIsOn) === true);
            if (isActiveUser) {
                uniqueUsers.set(userId, { userId, userData });
            }
        });
        // 🔹 중복 제거된 유저 리스트 생성
        const allUsers = Array.from(uniqueUsers.values());
        for (const { userId, userData } of allUsers) {
            const eventPageSnapshot = yield firebase_1.default
                .collection("eventPage")
                .where("eventUser.userId", "==", userId)
                .orderBy("eventTime", "desc")
                .limit(1)
                .select("eventTime")
                .get();
            if (eventPageSnapshot.empty)
                continue;
            const eventPageData = eventPageSnapshot.docs[0].data();
            const eventTimeRaw = eventPageData.eventTime;
            let eventTime = null;
            if (eventTimeRaw instanceof firestore_1.Timestamp) {
                eventTime = eventTimeRaw.toDate();
            }
            else if (typeof eventTimeRaw === "string") {
                eventTime = new Date(eventTimeRaw);
                if (isNaN(eventTime.getTime()))
                    eventTime = null;
            }
            if (!eventTime)
                continue;
            let userLastAccessTime = null;
            if (userData.userLastAccessTime instanceof firestore_1.Timestamp) {
                userLastAccessTime = userData.userLastAccessTime.toDate();
            }
            else if (typeof userData.userLastAccessTime === "string") {
                userLastAccessTime = new Date(userData.userLastAccessTime);
                if (isNaN(userLastAccessTime.getTime()))
                    userLastAccessTime = null;
            }
            const timeDifference = (currentTime.toDate().getTime() - eventTime.getTime()) / (1000 * 60 * 60);
            let isIncorrect = false;
            if (userData.userGender === 1 && timeDifference > 48)
                isIncorrect = true;
            if (userData.userGender === 2 && timeDifference > 120)
                isIncorrect = true;
            if (isIncorrect) {
                incorrectUsers.push({
                    userId,
                    userName: userData.userName,
                    userPhone: userData.userPhone,
                    datingGroup: ((_a = userData.dating) === null || _a === void 0 ? void 0 : _a.datingGroup) || null,
                    meetingGroup: ((_b = userData.meeting) === null || _b === void 0 ? void 0 : _b.meetingGroup) || null,
                    eventTime: eventTime,
                    userLastAccessTime,
                });
            }
        }
        return { totalActiveUsers: allUsers.length, incorrectUsers };
    });
}
// 잘못 활성화된 유저 Firestore에서 업데이트
function updateIncorrectlyActivatedUsers(handleDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const { incorrectUsers } = yield findIncorrectlyActivatedUsers(handleDate);
        if (incorrectUsers.length === 0) {
            console.log("✅ 업데이트할 유저 없음.");
            return [];
        }
        const batch = firebase_1.default.batch();
        const updatedUsers = [];
        for (const user of incorrectUsers) {
            const userRef = firebase_1.default.collection("user").doc(user.userId);
            const updates = {};
            if (user.datingGroup === "A") {
                updates["dating.datingGroup"] = "B";
            }
            if (user.meetingGroup === "A") {
                updates["meeting.meetingGroup"] = "B";
            }
            updates["userLastAccessTime"] = firestore_1.Timestamp.fromDate(user.eventTime);
            batch.update(userRef, updates);
            updatedUsers.push(Object.assign(Object.assign({}, user), { datingGroup: updates["dating.datingGroup"] || user.datingGroup, meetingGroup: updates["meeting.meetingGroup"] || user.meetingGroup, userLastAccessTime: user.eventTime }));
        }
        try {
            yield batch.commit(); // Firestore batch 업데이트
            console.log(`✅ 총 ${updatedUsers.length}명의 유저를 업데이트 완료`);
        }
        catch (error) {
            console.error("❌ Firestore 업데이트 중 에러 발생:", error);
        }
        return updatedUsers;
    });
}
// 실행 시 GET 요청과 POST 요청 구분
if (require.main === module) {
    findIncorrectlyActivatedUsers()
        .then((incorrectUsers) => {
        console.log("✅ 잘못 활성화된 유저 목록 (조회 전용):", incorrectUsers);
    })
        .catch(console.error);
}

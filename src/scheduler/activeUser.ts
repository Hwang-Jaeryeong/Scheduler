import dotenv from "dotenv";
import db from "../firebase/firebase";
import { Timestamp, WriteBatch } from "firebase-admin/firestore";

dotenv.config();

// 잘못 활성화된 유저 조회
export async function findIncorrectlyActivatedUsers(handleDate?: Date) {
    const currentTime = handleDate ? Timestamp.fromDate(handleDate) : Timestamp.now();
    const incorrectUsers = [];

    // 🔹 Firestore에서 활성화된 유저 조회
    const activeUsersQuery = db.collection("user")
        .where("userGender", "in", [1, 2])
        .get();

    const activeUsersSnapshot = await activeUsersQuery;

    // 🔹 중복 제거를 위한 `Map` 사용
    const uniqueUsers = new Map();

    activeUsersSnapshot.docs.forEach((doc) => {
        const userData = doc.data();
        const userId = doc.id;

        const userGender = userData.userGender;
        if (userGender !== 1 && userGender !== 2) return;

        const datingGroup = userData.dating?.datingGroup || null;
        const meetingGroup = userData.meeting?.meetingGroup || null;

        const isActiveUser =
            (datingGroup === "A" && userData.dating?.datingIsOn === true) ||
            (meetingGroup === "A" && userData.meeting?.meetingIsOn === true);

        if (isActiveUser) {
            uniqueUsers.set(userId, { userId, userData });
        }
    });

    // 🔹 중복 제거된 유저 리스트 생성
    const allUsers = Array.from(uniqueUsers.values());

    for (const { userId, userData } of allUsers) {
        const eventPageSnapshot = await db
            .collection("eventPage")
            .where("eventUser.userId", "==", userId)
            .orderBy("eventTime", "desc")
            .limit(1)
            .select("eventTime")
            .get();

        if (eventPageSnapshot.empty) continue;

        const eventPageData = eventPageSnapshot.docs[0].data();
        const eventTimeRaw = eventPageData.eventTime;

        let eventTime: Date | null = null;
        if (eventTimeRaw instanceof Timestamp) {
            eventTime = eventTimeRaw.toDate();
        } else if (typeof eventTimeRaw === "string") {
            eventTime = new Date(eventTimeRaw);
            if (isNaN(eventTime.getTime())) eventTime = null;
        }

        if (!eventTime) continue;

        let userLastAccessTime: Date | null = null;
        if (userData.userLastAccessTime instanceof Timestamp) {
            userLastAccessTime = userData.userLastAccessTime.toDate();
        } else if (typeof userData.userLastAccessTime === "string") {
            userLastAccessTime = new Date(userData.userLastAccessTime);
            if (isNaN(userLastAccessTime.getTime())) userLastAccessTime = null;
        }

        const timeDifference =
            (currentTime.toDate().getTime() - eventTime.getTime()) / (1000 * 60 * 60);

        let isIncorrect = false;
        if (userData.userGender === 1 && timeDifference > 48) isIncorrect = true;
        if (userData.userGender === 2 && timeDifference > 120) isIncorrect = true;

        if (isIncorrect) {
            incorrectUsers.push({
                userId,
                userName: userData.userName,
                userPhone: userData.userPhone,
                datingGroup: userData.dating?.datingGroup || null,
                meetingGroup: userData.meeting?.meetingGroup || null,
                eventTime: eventTime,
                userLastAccessTime,
            });
        }
    }

    return { totalActiveUsers: allUsers.length, incorrectUsers };
}



// 잘못 활성화된 유저 Firestore에서 업데이트
export async function updateIncorrectlyActivatedUsers(handleDate?: Date) {
    const { incorrectUsers } = await findIncorrectlyActivatedUsers(handleDate);
    if (incorrectUsers.length === 0) {
        console.log("✅ 업데이트할 유저 없음.");
        return [];
    }

    const batch: WriteBatch = db.batch();
    const updatedUsers = [];

    for (const user of incorrectUsers) {
        const userRef = db.collection("user").doc(user.userId);
        const updates: any = {};

        if (user.datingGroup === "A") {
            updates["dating.datingGroup"] = "B";
        }
        if (user.meetingGroup === "A") {
            updates["meeting.meetingGroup"] = "B";
        }
        updates["userLastAccessTime"] = Timestamp.fromDate(user.eventTime);

        batch.update(userRef, updates);

        updatedUsers.push({
            ...user,
            datingGroup: updates["dating.datingGroup"] || user.datingGroup,
            meetingGroup: updates["meeting.meetingGroup"] || user.meetingGroup,
            userLastAccessTime: user.eventTime,
        });
    }

    try {
        await batch.commit(); // Firestore batch 업데이트
        console.log(`✅ 총 ${updatedUsers.length}명의 유저를 업데이트 완료`);
    } catch (error) {
        console.error("❌ Firestore 업데이트 중 에러 발생:", error);
    }

    return updatedUsers;
}

// 실행 시 GET 요청과 POST 요청 구분
if (require.main === module) {
    findIncorrectlyActivatedUsers()
        .then((incorrectUsers) => {
            console.log("✅ 잘못 활성화된 유저 목록 (조회 전용):", incorrectUsers);
        })
        .catch(console.error);
}
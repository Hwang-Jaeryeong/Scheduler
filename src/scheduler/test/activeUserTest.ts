import db from "../../firebase/firebase";

async function run() {
    // 첫 번째 조건 쿼리
    const meetingQuery = await db.collection("user")
      .where("userGender", "==", 1)
      .where("meeting.meetingIsOn", "==", true)
      .where("meeting.meetingGroup", "==", "A")
      .get();
  
    // 두 번째 조건 쿼리
    const datingQuery = await db.collection("user")
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
  }
  
  run();
  
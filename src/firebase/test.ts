import db from "./firebase";

async function fetchUserData() {
  const snapshot = await db.collection("user")
    .where("userGender", "==", 1)  // userGender가 1인 사용자만 필터링
    .limit(3)  // 3명만 가져오기
    .get();

  if (snapshot.empty) {
    console.log("No matching documents.");
  } else {
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`userGender: ${data.userGender}`);
      console.log(`userPhone: ${data.userPhone}`);
    });
  }
}

fetchUserData().catch(err => console.error("Error fetching user data:", err));
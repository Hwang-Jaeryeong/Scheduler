import db from "./firebase";

async function fetchUserData() {
  const snapshot = await db.collection("user")
    .orderBy("admin.handleDate", "desc")
    .limit(10)
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`User ID: 2205081206001340`);
    console.log(`userPointBuy: ${data.userPointBuy}`);
    console.log(`userPointUse: ${data.userPointUse}`);
  });
}

fetchUserData().catch(err => console.error("Error fetching user data:", err));

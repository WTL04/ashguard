const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function sendNotification(threadId) {
  try {
    if (!threadId) {
      console.log("❌ Missing threadId. Usage: node sendNotification.js <threadId>");
      return;
    }

    const threadDoc = await db.collection("threads").doc(threadId).get();

    if (!threadDoc.exists) {
      console.log("❌ Thread not found");
      return;
    }

    const thread = threadDoc.data();

    const usersSnap = await db
      .collection("users")
      .where("officialNoticeNotificationsEnabled", "==", true)
      .get();

    const messages = [];

    usersSnap.forEach((doc) => {
      const user = doc.data();
      if (!user.expoPushToken) return;

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: "🚨 Official Notice",
        body: thread.title || "New official update posted",
        data: {
          threadId,
          screen: `/forum/${threadId}`,
          type: "official_notice",
        },
      });
    });

    if (messages.length === 0) {
      console.log("❌ No users to notify");
      return;
    }

    console.log(`📤 Sending ${messages.length} notifications for thread ${threadId}...`);

    const response = await globalThis.fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const data = await response.json();
    console.log("✅ Notification response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Error sending notifications:", error);
  }
}

const threadId = process.argv[2];
sendNotification(threadId);
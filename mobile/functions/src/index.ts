import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

initializeApp();

export const sendOfficialNotification = onDocumentCreated(
  "threads/{threadId}",
  async (event) => {
    const thread = event.data?.data();

    if (!thread) {
      console.log("No thread data found.");
      return;
    }

    const isOfficial =
      thread.type === "official" || thread.pinned === true;

    if (!isOfficial) {
      console.log("Not an official post, skipping...");
      return;
    }

    console.log("Official post detected:", thread.title);

    const db = getFirestore();

    const usersSnapshot = await db
      .collection("users")
      .where("officialNoticeNotificationsEnabled", "==", true)
      .get();

    const messages = usersSnapshot.docs
      .map((doc) => doc.data())
      .filter((user) => !!user.expoPushToken)
      .map((user) => ({
        to: user.expoPushToken,
        sound: "default",
        title: "Official Notice",
        body: thread.title || "New official update posted",
        data: {
          threadId: event.params.threadId,
        },
      }));

    if (messages.length === 0) {
      console.log("No users to notify.");
      return;
    }

    console.log(`Sending notifications to ${messages.length} users`);

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.text();
    console.log("Expo push response:", result);
  }
);
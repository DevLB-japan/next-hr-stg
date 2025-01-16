// api/server.js

import { db } from "./lib/firebaseAdmin.js";
import { Client } from "@line/bot-sdk";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// Webhookハンドラー
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      return res.status(200).send("No events found.");
    }

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        const userMessage = event.message.text;

        // 1) Firestoreから conversationId を取得
        let conversationId = null;
        const userDocRef = db.collection("conversations").doc(userId);
        const userDocSnap = await userDocRef.get();

        if (userDocSnap.exists) {
          conversationId = userDocSnap.data().conversationId || null;
        }

        // 2) Dify API呼び出し
        const requestBody = {
          inputs: {},
          query: userMessage,
          response_mode: "blocking",
          user: "line-bot",
        };
        if (conversationId) requestBody.conversation_id = conversationId;

        const difyResponse = await fetch(
          process.env.DIFY_API_URL || "https://api.dify.ai/v1/chat-messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        const difyData = await difyResponse.json();

        // 3) conversationId が無ければFirestoreに保存
        if (!conversationId && difyData.conversation_id) {
          await userDocRef.set(
            {
              userId,
              conversationId: difyData.conversation_id,
              updatedAt: new Date(),
            },
            { merge: true }
          );
        }

        // 4) LINE返信
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: difyData.answer || "エラーが発生しました。",
        });
      }
    }

    res.status(200).send("Success");
  } catch (err) {
    console.error("Error handling webhook:", err);
    res.status(500).send("Internal Server Error");
  }
}

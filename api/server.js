import { middleware, Client } from "@line/bot-sdk";
import dotenv from "dotenv";
import fetch from "node-fetch";

// 環境変数の読み込み
dotenv.config();

const DIFY_API_URL =
  process.env.DIFY_API_URL || "https://api.dify.ai/v1/chat-messages";
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// `conversation_id` を保持するためのマップ
const userConversations = {};

// Webhookエンドポイント
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
        const userId = event.source.userId; // ユーザーごとの識別子
        const userMessage = event.message.text;

        // 既存の conversation_id を取得、または初期化
        let conversationId = userConversations[userId];

        // Dify APIへのリクエストボディを構築
        const requestBody = {
          inputs: {},
          query: userMessage,
          response_mode: "blocking",
          user: "line-bot",
        };

        // 初回の場合は conversation_id を含めない
        if (conversationId) {
          requestBody.conversation_id = conversationId;
        }

        // Dify APIへのリクエスト
        const difyResponse = await fetch(DIFY_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DIFY_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
        });

        const difyData = await difyResponse.json();

        // `conversation_id` を保存（初回リクエストで取得）
        if (!conversationId && difyData.conversation_id) {
          userConversations[userId] = difyData.conversation_id;
        }

        // LINEメッセージの返信
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

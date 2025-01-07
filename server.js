import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";

// 環境変数の読み込み
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DIFY_API_URL =
  process.env.DIFY_API_URL || "https://api.dify.ai/v1/chat-messages";
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

const app = express();
const port = 3000;

// LINE設定
const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// `conversation_id` を保持するためのマップ
const userConversations = {};

// Middlewareの設定
app.use(middleware(config));

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
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
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// サーバー起動
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

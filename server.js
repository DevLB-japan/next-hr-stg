////////////////////////////////////////////////////
// server.js
////////////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

import webhookRouter from "./routes/webhook.js"; // 既存: LINE用
import reportRouter from "./routes/report.js"; // 新規: Difyレポート受信用

dotenv.config();

const app = express();

/**
 * JSONパーサ設定:
 *  limit を大きめにし、strict: false で改行等にも寛容にする
 *  また、下のエラーハンドラでパース失敗を捕捉してログ化
 */
app.use(express.json({ limit: "2mb", strict: false }));

/**
 * BodyParser/その他エラーをキャッチ
 */
app.use((err, req, res, next) => {
  console.error("[GlobalErrorHandler] Error:", err);
  if (err.type === "entity.parse.failed") {
    // JSON parse 失敗
    return res.status(400).send("Invalid JSON body");
  }
  return res.status(500).send("Server Error");
});

/**
 * ルーティング設定
 *
 * /webhook: LINE Webhook
 * /report: Dify レポート送信用
 */
app.use("/webhook", webhookRouter);
app.use("/report", reportRouter);

// 簡単なhealthcheck
app.get("/", (req, res) => {
  res.status(200).send("OK from root path");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

////////////////////////////////////////////
// server.js
////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

// 例: Webhook用のルータ (lineWebhook)
import webhookRouter from "./routes/webhook.js";

dotenv.config();

const app = express();

/**
 * 1) JSONパーサ設定
 *   - limit: 1mb (必要に応じて拡大可能)
 *   - strict: false (改行や特殊文字による厳格エラーを減らす)
 */
app.use(express.json({ limit: "1mb", strict: false }));

/**
 * 2) Body parse などでエラーが起きた場合の
 *    グローバルエラーハンドリングミドルウェア
 */
app.use((err, req, res, next) => {
  console.error("Express error-handling middleware triggered:", err);

  // body-parser が投げるエラーなど
  if (err.type === "entity.parse.failed") {
    // JSONのパース失敗
    return res.status(400).send("Invalid JSON or parse error");
  }

  // その他のエラー
  return res.status(500).send("Server error");
});

/**
 * 3) ルーティング: /webhook
 *   - LINE Webhook用 (例)
 */
app.use("/webhook", webhookRouter);

// ポート設定
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

////////////////////////////////////////////////////
// server.js
////////////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

// Routes (例)
import webhookRouter from "./routes/webhook.js";
// 他にも mailRouter, reportRouter などあれば import

dotenv.config();

const app = express();

/**
 * JSONパーサ設定:
 *  - limit: 1mb (適宜拡大可能)
 *  - strict: false (改行や特殊文字で厳格エラーを起こさない)
 */
app.use(express.json({ limit: "1mb", strict: false }));

/**
 * Body parserエラーや他のミドルウェアエラーをキャッチする
 * グローバル エラーハンドリングミドルウェア
 */
app.use((err, req, res, next) => {
  // express.json()がパース失敗すると err.type === 'entity.parse.failed' など
  console.error("[GlobalErrorHandler] Caught an error:", err);

  if (err.type === "entity.parse.failed") {
    // JSONパース失敗時
    return res.status(400).send("Invalid JSON or parse error");
  }

  // ここに該当しなければ500など
  return res.status(500).send("Server Error");
});

/**
 * ルート設定:
 *  例: /webhook → webhookRouter
 */
app.use("/webhook", webhookRouter);
// 例: app.use("/mail", mailRouter);
// 例: app.use("/report", reportRouter);

// ヘルスチェック or ルートパス
app.get("/", (req, res) => {
  res.status(200).send("OK from root path");
});

// サーバ起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

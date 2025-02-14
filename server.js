////////////////////////////////////////////////////
// server.js
////////////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

import webhookRouter from "./routes/webhook.js"; // LINE用
import reportRouter from "./routes/report.js"; // Difyレポート用

dotenv.config();

const app = express();

/**
 * JSONパーサ設定:
 *  - limit: 2mb     : 大きなペイロードを許容
 *  - strict: false  : 改行、特殊文字、数字などが混じったJSONを寛容に処理
 */
app.use(express.json({ limit: "2mb", strict: false }));

/**
 * グローバル エラーハンドラ:
 *  body-parser (express.json) の parse 失敗時 (entity.parse.failed) など、
 *  その他のミドルウェアエラーを捕捉する。
 */
app.use((err, req, res, next) => {
  console.error("[GlobalErrorHandler] Error:", err);

  if (err.type === "entity.parse.failed") {
    // JSONパース失敗 (SyntaxError等)
    return res.status(400).json({ error: "Invalid JSON or parse error" });
  }

  // それ以外のエラー
  return res.status(500).json({ error: "Server Error" });
});

/**
 * ルーティング設定:
 *  /webhook -> LINE用
 *  /report  -> Difyレポート用
 */
app.use("/webhook", webhookRouter);
app.use("/report", reportRouter);

/**
 * 簡易healthcheck / rootアクセス
 */
app.get("/", (req, res) => {
  res.status(200).send("OK from root path");
});

/**
 * サーバ起動
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

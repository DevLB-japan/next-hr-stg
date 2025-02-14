////////////////////////////////////////////////////
// server.js
////////////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

// ルータ
import webhookRouter from "./routes/webhook.js"; // LINE用
import reportRouter from "./routes/report.js"; // Difyレポート用

dotenv.config();

const app = express();

/**
 * 1) 「生のリクエストボディ」をログ出しするミドルウェア
 *    ここで body-parser の前に仕込むと、パース失敗時でも rawBody を記録可能
 */
app.use((req, res, next) => {
  let rawBody = "";
  req.on("data", (chunk) => {
    rawBody += chunk;
  });
  req.on("end", () => {
    console.log(`[RAW] ${req.method} ${req.originalUrl}\n`, rawBody);
    next();
  });
});

/**
 * 2) JSONパーサ
 *    - limit: 2mb  : 大きめのJSONも許可
 *    - strict: false : 改行や特殊文字を寛容に扱う
 */
app.use(express.json({ limit: "2mb", strict: false }));

/**
 * 3) グローバルエラーハンドラ
 *    - JSON parse失敗などでエラーがあった場合もログ
 */
app.use((err, req, res, next) => {
  console.error("[GlobalErrorHandler] error:", err);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON or parse error" });
  }
  return res.status(500).json({ error: "Server error" });
});

/**
 * 4) ルーティング
 */
app.use("/webhook", webhookRouter);
app.use("/report", reportRouter);

/**
 * 5) ヘルスチェックなど
 */
app.get("/", (req, res) => {
  res.send("OK from root path");
});

/**
 * 6) サーバ起動
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

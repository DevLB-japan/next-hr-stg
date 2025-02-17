//////////////////////////////////////////////////////////
// server.js
//////////////////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";

// すでに存在する webhook
import webhookRouter from "./routes/webhook.js";

// ★ 「report」系のルートが必要なら必ずインポート
import reportRouter from "./routes/report.js";

// （もし mailRouter が必要なら同様に import ... from "./routes/mail.js"; ）

dotenv.config();

const app = express();

/**
 * JSONパース設定:
 * - limitを大きめに（2MB等）
 * - strict: false にして改行含む多少の不正JSONもパース受容
 */
app.use(express.json({ limit: "2mb", strict: false }));

// ALB が GET / でヘルスチェックする場合 → OK返すだけ
app.get("/", (req, res) => {
  res.status(200).send("OK from root path");
});

// Health check用
app.get("/healthz", (req, res) => {
  res.status(200).send("healthy");
});

// =============================
// 必須ルート
// =============================

// LINE Webhookルート
app.use("/webhook", webhookRouter);

// ★ レポート生成ルート
app.use("/report", reportRouter);

// もしメール関連があるなら
// import mailRouter from "./routes/mail.js";
// app.use("/mail", mailRouter);

// =============================
// グローバルエラーハンドラ (末尾で)
app.use(globalErrorHandler);

// =============================
// サーバ起動
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ALBの idleTimeout に合わせる
server.keepAliveTimeout = 125000;
server.headersTimeout = 130000;

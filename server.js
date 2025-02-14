//////////////////////////////////////////////////////////
// server.js
//////////////////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";
import webhookRouter from "./routes/webhook.js";

dotenv.config();

const app = express();

/**
 * JSONパース設定:
 * - limitを大きめ (2mb 等)
 * - strict: false で多少の不正も受容 (改行など)
 */
app.use(express.json({ limit: "2mb", strict: false }));

// ALB がよく GET / とかヘルスチェックする -> 返答だけする
app.get("/", (req, res) => {
  res.status(200).send("OK from root path");
});

// Health check endpoint
app.get("/healthz", (req, res) => {
  res.status(200).send("healthy");
});

// Webhookルート
app.use("/webhook", webhookRouter);

// 何かのテストでreport関連呼び出すなら
// import reportRouter from "./routes/report.js";
// app.use("/report", reportRouter);

// グローバルエラーハンドラ (最後に)
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// keep-alive (ALBのidleTimeoutに合わせる)
server.keepAliveTimeout = 125000;
server.headersTimeout = 130000; //

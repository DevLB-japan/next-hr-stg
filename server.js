////////////////////////////////////////////////////
// server.js
////////////////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";
// ルータ類
import webhookRouter from "./routes/webhook.js";
import reportRouter from "./routes/report.js";

dotenv.config();
const app = express();

app.use(express.json({ limit: "5mb" })); // JSONパーサ設定

// ヘルスチェック用エンドポイント
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// LINE 用 webhook
app.use("/webhook", webhookRouter);

// Dify 用 report
app.use("/report", reportRouter);

// 全体エラー捕捉(簡易)
app.use((err, req, res, next) => {
  console.error("[GlobalErrorHandler]", err);
  return res.status(500).send("Internal Server Error");
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Keep-Alive 対応: ALBの idle timeout(60秒) より長めに
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

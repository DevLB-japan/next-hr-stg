///////////////////////////////////////////
// server.js
///////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

// 他のルート
import webhookRouter from "./routes/webhook.js"; // デフォルトインポート
import mailRouter from "./routes/mail.js";
import reportRouter from "./routes/report.js";

dotenv.config();

const app = express();
app.use(express.json());

// ★ ルートパス ("/") を追加
// ALBのヘルスチェックなどが http://<ALB DNS>/ にアクセスした際、200を返す
app.get("/", (req, res) => {
  res.status(200).send("OK from root path");
});

// /webhook
app.use("/webhook", webhookRouter);

// /mail
app.use("/mail", mailRouter);

// /report
app.use("/report", reportRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

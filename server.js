///////////////////////////////////////////
// server.js
///////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

// ほかのルート
import webhookRouter from "./routes/webhook.js";
import mailRouter from "./routes/mail.js";
import reportRouter from "./routes/report.js";

dotenv.config();

const app = express();
app.use(express.json());

// LINE Webhook
app.use("/webhook", webhookRouter);

// メール送信用
app.use("/mail", mailRouter);

// レポート用
app.use("/report", reportRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

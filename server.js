///////////////////////////////////////////
// server.js
///////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

// 他のルート例
import webhookRouter from "./routes/webhook.js"; // デフォルトインポート
import mailRouter from "./routes/mail.js";
import reportRouter from "./routes/report.js";

dotenv.config();

const app = express();
app.use(express.json());

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

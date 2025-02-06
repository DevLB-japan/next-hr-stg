////////////////////////////////////////////////////
// controllers/mailController.js
////////////////////////////////////////////////////
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { generatePdfFromHtml } from "../services/pdfGenerator.js";
import { sendMailWithSes } from "../services/sendMail.js";

/**
 * POST /mail/send
 * body: {
 *   "to": "someone@example.com",
 *   "subject": "Test subject",
 *   "name": "山田太郎",
 *   "contentA": "...",
 *   "contentB": "...",
 *   "attachPdf": true/false
 * }
 */
export async function mailController(req, res) {
  try {
    const { to, subject, name, contentA, contentB, attachPdf } = req.body;

    // 1) テンプレ読み込み
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "mailTemplate.html"
    );
    const templateSrc = fs.readFileSync(templatePath, "utf-8");
    const template = Handlebars.compile(templateSrc);

    // 2) HTML生成
    const htmlString = template({ name, contentA, contentB });

    // 3) PDF添付するか
    let pdfBuffer = null;
    if (attachPdf) {
      pdfBuffer = await generatePdfFromHtml(htmlString);
    }

    // 4) SES送信
    await sendMailWithSes({
      to,
      subject,
      htmlBody: htmlString,
      pdfBuffer,
    });

    res.status(200).json({ message: "Mail sent successfully" });
  } catch (err) {
    console.error("Error in mailController:", err);
    res.status(500).json({ error: "Failed to send mail" });
  }
}

////////////////////////////////////////////////////
// /controllers/reportController.js
////////////////////////////////////////////////////
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { nanoid } from "nanoid";
import { generatePdfFromHtml } from "../services/pdfGenerator.js";
import { uploadPdfToS3 } from "../services/s3Upload.js";
import { createReport } from "../db/reports.js";
import { getLineUserById } from "../db/lineUsers.js";
import { getCompanyById } from "../db/companies.js";
import { sendMailWithSes } from "../services/sendMail.js";

/**
 * POST /report/create
 * body: {
 *   "lineUserId": "...", // (line_user_id) PK
 *   "dataA": "...",
 *   "dataB": "..."
 * }
 */
export async function createReportController(req, res) {
  try {
    const { lineUserId, dataA, dataB } = req.body;

    // 1) lineUser取得
    const lineUser = await getLineUserById(lineUserId);
    if (!lineUser) {
      return res.status(400).json({ error: "Invalid lineUserId" });
    }

    // 2) 企業取得
    const company = await getCompanyById(lineUser.company_id);
    if (!company) {
      return res.status(400).json({ error: "No company found for user" });
    }

    // 3) テンプレHTML読み込み
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "reportTemplate.html"
    );
    const templateSrc = fs.readFileSync(templatePath, "utf-8");
    const template = Handlebars.compile(templateSrc);

    // 4) HTML生成
    const htmlString = template({ dataA, dataB });

    // 5) PDF生成
    const pdfBuffer = await generatePdfFromHtml(htmlString);

    // 6) S3にアップロード
    const reportId = nanoid(18);
    const pdfKey = `reports/${reportId}.pdf`;
    await uploadPdfToS3(pdfBuffer, pdfKey);

    // 7) DBの reports に登録
    const newReport = await createReport({
      company_id: lineUser.company_id,
      line_user_id: lineUserId,
      report_json: { dataA, dataB },
      s3_path: pdfKey,
      remarks: "レポート生成 & S3格納",
    });

    // 8) メール送信 (PDF添付)
    //    送信先 = 会社の email_address
    if (company.email_address) {
      const htmlBody = "<p>レポートを添付いたします。</p>";
      await sendMailWithSes({
        to: company.email_address,
        subject: "レポート作成完了",
        htmlBody,
        pdfBuffer,
      });
    } else {
      console.warn(`Company ${company.company_id} has no email_address set.`);
    }

    res.status(200).json({
      message: "Report created, PDF stored in S3, and mail sent",
      report: newReport,
    });
  } catch (err) {
    console.error("Error in createReportController:", err);
    res.status(500).json({ error: "Failed to create report" });
  }
}

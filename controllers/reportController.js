////////////////////////////////////////////////////
// controllers/reportController.js
////////////////////////////////////////////////////
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { nanoid } from "nanoid";

import { generatePdfFromHtml } from "../services/pdfGenerator.js";
import { uploadPdfToS3 } from "../services/s3Upload.js";
import { createReport } from "../db/reports.js";
import { getLineUserByConversation } from "../db/lineUsers.js";
import { getCompanyById } from "../db/companies.js";
import { sendMailWithSes } from "../services/sendMail.js";

/**
 * POST /report/create
 *
 * Expecting JSON with a structure like:
 * {
 *   "conversation_id": "...",        // Dify's conversation_id
 *   "basic_info": {...},
 *   "ai_questions": {...},
 *   "match_analysis": {...},
 *   "personality_analysis": {...},
 *   "recommended_actions": {...}
 * }
 */
export async function createReportController(req, res) {
  try {
    // 1) retrieve conversation_id from the request body
    const {
      conversation_id,
      basic_info,
      ai_questions,
      match_analysis,
      personality_analysis,
      recommended_actions,
    } = req.body;

    // must have conversation_id
    if (!conversation_id) {
      return res.status(400).json({ error: "No conversation_id provided" });
    }

    // 2) find lineUser by conversation_id
    const lineUser = await getLineUserByConversation(conversation_id);
    if (!lineUser) {
      return res
        .status(400)
        .json({ error: "No lineUser found for the given conversation_id" });
    }

    // 3) find company
    const company = await getCompanyById(lineUser.company_id);
    if (!company) {
      return res
        .status(400)
        .json({ error: "No company found for that lineUser" });
    }

    // 4) read template (reportTemplate.html)
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "reportTemplate.html"
    );
    const templateSrc = fs.readFileSync(templatePath, "utf-8");
    const template = Handlebars.compile(templateSrc);

    // build HTML content
    const htmlContext = {
      basic_info,
      ai_questions,
      match_analysis,
      personality_analysis,
      recommended_actions,
    };
    const htmlString = template(htmlContext);

    // 5) generate PDF from HTML
    const pdfBuffer = await generatePdfFromHtml(htmlString); // e.g. using puppeteer

    // 6) upload PDF to S3
    const reportId = nanoid(18);
    const pdfKey = `reports/${reportId}.pdf`;
    await uploadPdfToS3(pdfBuffer, pdfKey);

    // 7) create a new record in reports table
    const newReport = await createReport({
      company_id: lineUser.company_id,
      line_user_id: lineUser.line_user_id,
      report_json: {
        basic_info,
        ai_questions,
        match_analysis,
        personality_analysis,
        recommended_actions,
      },
      s3_path: pdfKey,
      remarks: "Report created using conversation_id",
    });

    // 8) send mail if company.email_address is present
    if (company.email_address) {
      const htmlBody = "<p>レポートを添付いたします。</p>";
      await sendMailWithSes({
        to: company.email_address,
        subject: "レポート作成完了",
        htmlBody,
        pdfBuffer,
      });
      console.log(
        "[createReportController] Mail sent to",
        company.email_address
      );
    } else {
      console.warn(
        `[createReportController] Company ${company.company_id} has no email_address, skip mail.`
      );
    }

    return res.status(200).json({
      message: "Report created, PDF stored in S3, and mail sent",
      report: newReport,
    });
  } catch (err) {
    console.error("Error in createReportController:", err);
    return res.status(500).json({ error: "Failed to create report" });
  }
}

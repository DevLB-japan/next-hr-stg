///////////////////////////////////////////
// services/sendMail.js
///////////////////////////////////////////
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import dotenv from "dotenv";
dotenv.config();

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} htmlBody
 * @param {Buffer} [pdfBuffer]
 */
export async function sendMailWithSes({ to, subject, htmlBody, pdfBuffer }) {
  const from = process.env.SES_FROM_ADDRESS || "noreply@nexthr.jp";
  const boundary = "NextPart_Boundary";

  let rawMessage;
  if (!pdfBuffer) {
    // 添付なし
    rawMessage = `Content-Type: multipart/alternative; boundary="${boundary}"
From: ${from}
To: ${to}
Subject: ${subject}

--${boundary}
Content-Type: text/html; charset="UTF-8"

${htmlBody}

--${boundary}--
`;
  } else {
    // 添付あり
    const pdfBase64 = pdfBuffer.toString("base64");

    rawMessage = `Content-Type: multipart/mixed; boundary="${boundary}"
From: ${from}
To: ${to}
Subject: ${subject}

--${boundary}
Content-Type: text/html; charset="UTF-8"

${htmlBody}

--${boundary}
Content-Type: application/pdf; name="report.pdf"
Content-Disposition: attachment; filename="report.pdf"
Content-Transfer-Encoding: base64

${pdfBase64}
--${boundary}--
`;
  }

  const sesClient = new SESClient({
    region: process.env.AWS_REGION,
    // IAMロールをEC2に付ければキー不要
  });

  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage, "utf-8"),
    },
  });
  const response = await sesClient.send(command);
  console.log("Email sent. MessageId:", response.MessageId);
  return response;
}

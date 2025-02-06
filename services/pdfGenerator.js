///////////////////////////////////////////
// services/pdfGenerator.js
///////////////////////////////////////////
import puppeteer from "puppeteer";

export async function generatePdfFromHtml(htmlString) {
  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();
  await page.setContent(htmlString, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4" });
  await browser.close();
  return pdfBuffer;
}

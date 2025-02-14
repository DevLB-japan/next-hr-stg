////////////////////////////////////////////////////
// services/pdfGenerator.js
////////////////////////////////////////////////////
import puppeteer from "puppeteer";

export async function generatePdfFromHtml(htmlString) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new", // or true (旧指定), new = Puppeteer v20+ で推奨
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
    });

    return pdfBuffer;
  } catch (err) {
    console.error("[generatePdfFromHtml] Puppeteer error:", err);
    throw err; // rethrow
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

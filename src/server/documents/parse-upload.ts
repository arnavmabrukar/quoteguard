import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import Papa from "papaparse";
import { db } from "../db";
import { AppError } from "../access";
export async function parseUpload(file: File) {
  if (file.size > 4 * 1024 * 1024 || !file.size)
    throw new AppError(
      422,
      "FILE_SIZE",
      "Choose a nonempty file smaller than 4 MB.",
    );
  const ext = path.extname(file.name).toLowerCase();
  if (![".txt", ".csv", ".xlsx", ".pdf"].includes(ext))
    throw new AppError(
      422,
      "FILE_TYPE",
      "Supported formats: TXT, CSV, XLSX, and text-based PDF.",
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  let text = "";
  let locations: string[] = [];
  const sheets: { name: string; rows: string[][] }[] = [];
  if (ext === ".pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new AppError(
        422,
        "FILE_TYPE",
        "The file does not contain a valid PDF header.",
      );
    const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
    let pageNumber = 0;
    await pdf(bytes, {
      pagerender: async (page: {
        getTextContent: () => Promise<{
          items: { str: string; transform: number[] }[];
        }>;
      }) => {
        pageNumber++;
        const content = await page.getTextContent();
        let previousY: number | undefined;
        let pageText = "";
        for (const item of content.items) {
          const y = item.transform?.[5];
          pageText +=
            (previousY !== undefined && y !== previousY ? "\n" : " ") +
            item.str;
          previousY = y;
        }
        const pageLines = pageText.trim().split("\n");
        text += pageLines.join("\n") + "\n";
        locations.push(...pageLines.map(() => `Page ${pageNumber}`));
        return pageText;
      },
    });
  } else if (ext === ".xlsx") {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new AppError(
        422,
        "FILE_TYPE",
        "The file does not contain an XLSX workbook.",
      );
    // Reject large declared ZIP expansion before passing a workbook to ExcelJS.
    let expanded = 0;
    for (let i = 0; i < bytes.length - 46; i++) {
      if (bytes.readUInt32LE(i) === 0x02014b50) {
        expanded += bytes.readUInt32LE(i + 24);
        if (expanded > 20 * 1024 * 1024)
          throw new AppError(
            422,
            "FILE_SIZE",
            "The expanded workbook exceeds 20 MB.",
          );
      }
    }
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as never);
    for (const sheet of workbook.worksheets.slice(0, 10)) {
      if (sheet.rowCount > 1001 || sheet.columnCount > 50)
        throw new AppError(
          422,
          "SHEET_SIZE",
          "Limit sheets to 1,000 items and 50 columns.",
        );
      const rows: string[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        for (let col = 1; col <= sheet.columnCount; col++) {
          const cell = row.getCell(col);
          if (cell.type === ExcelJS.ValueType.Formula)
            throw new AppError(
              422,
              "FORMULA",
              "Spreadsheet formulas are not accepted. Export values only.",
            );
          cells.push(cell.text);
        }
        rows.push(cells);
      });
      if (rows.length) sheets.push({ name: sheet.name, rows });
    }
  } else {
    text = bytes.toString("utf8");
    if (text.includes("\u0000"))
      throw new AppError(
        422,
        "FILE_TYPE",
        "This file is not readable UTF-8 text.",
      );
    if (ext === ".csv") {
      const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
      if (result.errors.length)
        throw new AppError(
          422,
          "CSV",
          "CSV could not be parsed. Check delimiters and quoted cells.",
        );
      if (result.data.length > 1001)
        throw new AppError(422, "SHEET_SIZE", "Limit imports to 1,000 rows.");
      sheets.push({ name: "CSV", rows: result.data });
    }
  }
  if (!text.trim() && !sheets.length)
    throw new AppError(
      422,
      "NO_TEXT",
      "No readable text was found. Paste the text or upload a text-based document.",
    );
  if (text.length > 60000)
    throw new AppError(
      422,
      "TEXT_SIZE",
      "Extracted text is too long. Limit the request to 60,000 characters.",
    );
  const id = crypto.randomUUID();
  const storageKey = id + ext;
  const data = { text, locations, sheets };
  await db.document.create({
    data: {
      id,
      filename: path.basename(file.name),
      storageKey,
      content: bytes,
      hash: createHash("sha256").update(bytes).digest("hex"),
      data: JSON.stringify(data),
    },
  });
  return { id, filename: file.name, ...data };
}

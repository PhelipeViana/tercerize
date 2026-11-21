"use client";

export interface ReportExportInput {
  content: string;
  tenantName: string;
  tenantCnpj: string;
  roleName: string;
  emittedAt: string;
}

type ReportBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

function stripInlineMarkdown(raw: string): string {
  return raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => stripInlineMarkdown(cell));
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const stripped = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const parts = stripped.split("|").map((p) => p.trim());
  return parts.length > 0 && parts.every((p) => /^:?-{3,}:?$/.test(p));
}

function parseReportMarkdown(markdown: string): { title: string; blocks: ReportBlock[] } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReportBlock[] = [];
  let title = "Relatório Gerencial";
  let foundTitle = false;
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      if (codeLines.length > 0) {
        blocks.push({ type: "paragraph", text: codeLines.join("\n") });
      }
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
      const cleanText = stripInlineMarkdown(headingMatch[2]);
      if (!foundTitle && cleanText) {
        title = cleanText;
        foundTitle = true;
      }
      blocks.push({ type: "heading", level, text: cleanText });
      i++;
      continue;
    }

    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim() !== "") {
        const parsedRow = splitTableRow(lines[i]);
        rows.push(headers.map((_, idx) => parsedRow[idx] ?? ""));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(stripInlineMarkdown(lines[i].trim().replace(/^>\s?/, "")));
        i++;
      }
      blocks.push({ type: "paragraph", text: quoteLines.join(" ") });
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(stripInlineMarkdown(lines[i].trim().replace(/^[-*•]\s+/, "")));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(stripInlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s+|[-*•]\s+|\d+\.\s+|>\s?|```|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim()) &&
      !(lines[i].trim().includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(stripInlineMarkdown(lines[i]));
      i++;
    }
    const merged = paraLines.join(" ").trim();
    if (merged) {
      blocks.push({ type: "paragraph", text: merged });
    }
  }

  return { title, blocks };
}

function slugifyFile(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "relatorio"
  );
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseBRLCurrency(cell: string): number | null {
  const match = /^R\$\s*(-?[\d.]+,\d{2})$/.exec(cell.trim());
  if (!match) return null;
  const num = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export async function exportReportToExcel(input: ReportExportInput): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const { title, blocks } = parseReportMarkdown(input.content);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Tercerize";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Relatório", {
    views: [{ showGridLines: true }],
  });

  // Cabeçalho oficial da empresa
  const titleRow = sheet.addRow([`TERCERIZE — ${title.toUpperCase()}`]);
  titleRow.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FF1D4ED8" } };
  titleRow.height = 24;

  const companyRow = sheet.addRow([`Empresa: ${input.tenantName}`, `CNPJ: ${input.tenantCnpj}`]);
  companyRow.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };

  const metaRow = sheet.addRow([`Emitido em: ${input.emittedAt}`, `Perfil: ${input.roleName}`]);
  metaRow.font = { name: "Calibri", size: 9, color: { argb: "FF475569" } };

  sheet.addRow([]);

  let maxCols = 2;
  let tableIndex = 0;

  for (const block of blocks) {
    if (block.type === "heading") {
      const r = sheet.addRow([block.text]);
      r.font = {
        name: "Calibri",
        size: block.level === 1 ? 12 : 11,
        bold: true,
        color: { argb: "FF0F172A" },
      };
      r.height = 20;
    } else if (block.type === "table") {
      tableIndex++;
      maxCols = Math.max(maxCols, block.headers.length);

      const headerRow = sheet.addRow(block.headers);
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      block.rows.forEach((rowValues, rIdx) => {
        const typedValues = rowValues.map((val) => {
          const brl = parseBRLCurrency(val);
          if (brl !== null) return brl;
          if (/^-?\d+$/.test(val.trim()) && val.trim().length <= 10) {
            return Number(val.trim());
          }
          return val;
        });
        const r = sheet.addRow(typedValues);
        r.eachCell((cell, colNumber) => {
          const rawVal = rowValues[colNumber - 1] ?? "";
          if (parseBRLCurrency(rawVal) !== null) {
            cell.numFmt = '"R$" #,##0.00';
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
          }
          cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
          if (rIdx % 2 === 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      sheet.addRow([]);

      // Cria também uma aba limpa dedicada aos dados tabulares para filtro/ordenação imediata
      const dataSheet = wb.addWorksheet(tableIndex === 1 ? "Dados" : `Dados ${tableIndex}`, {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      const dsHead = dataSheet.addRow(block.headers);
      dsHead.height = 22;
      dsHead.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B68F7" } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });
      block.rows.forEach((rowValues) => {
        const typedValues = rowValues.map((val) => {
          const brl = parseBRLCurrency(val);
          if (brl !== null) return brl;
          if (/^-?\d+$/.test(val.trim()) && val.trim().length <= 10) {
            return Number(val.trim());
          }
          return val;
        });
        const dr = dataSheet.addRow(typedValues);
        dr.eachCell((cell, colNumber) => {
          if (parseBRLCurrency(rowValues[colNumber - 1] ?? "") !== null) {
            cell.numFmt = '"R$" #,##0.00';
          }
        });
      });
      dataSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, block.rows.length + 1), column: block.headers.length },
      };
      dataSheet.columns.forEach((col, idx) => {
        const headerLen = (block.headers[idx] ?? "").length;
        const maxCellLen = block.rows.reduce((m, r) => Math.max(m, (r[idx] ?? "").length), headerLen);
        col.width = Math.min(44, Math.max(14, maxCellLen + 4));
      });
    } else if (block.type === "list") {
      block.items.forEach((item, idx) => {
        const prefix = block.ordered ? `${idx + 1}. ` : "• ";
        const r = sheet.addRow([prefix + item]);
        r.font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };
      });
      sheet.addRow([]);
    } else if (block.type === "paragraph") {
      const r = sheet.addRow([block.text]);
      r.font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };
      r.alignment = { wrapText: true };
    }
  }

  for (let c = 1; c <= maxCols; c++) {
    const col = sheet.getColumn(c);
    let widest = c === 1 ? 36 : 18;
    col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber <= 3) return;
      const len = String(cell.value ?? "").length;
      if (len > widest) widest = len;
    });
    col.width = Math.min(48, Math.max(15, widest + 3));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `relatorio-${slugifyFile(input.tenantName)}-${dateStamp}.xlsx`);
}

export async function exportReportToPDF(input: ReportExportInput): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { title, blocks } = parseReportMarkdown(input.content);

  const hasWideTable = blocks.some((b) => b.type === "table" && b.headers.length >= 7);
  const doc = new jsPDF({
    orientation: hasWideTable ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // Cabeçalho oficial da empresa na Página 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(59, 104, 247);
  doc.text("TERCERIZE · RELATÓRIO GERENCIAL", marginX, 14);

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(input.tenantName, marginX, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`CNPJ: ${input.tenantCnpj}`, marginX, 26);

  doc.text(`Emitido em: ${input.emittedAt}`, pageWidth - marginX, 19, { align: "right" });
  doc.text(`Perfil: ${input.roleName}`, pageWidth - marginX, 25, { align: "right" });

  doc.setDrawColor(59, 104, 247);
  doc.setLineWidth(0.6);
  doc.line(marginX, 30, pageWidth - marginX, 30);

  let y = 37;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(block.level === 1 ? 12 : block.level === 2 ? 10.5 : 9.5);
      doc.setTextColor(15, 23, 42);
      const wrapped = doc.splitTextToSize(block.text, contentWidth);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 5.2 + 2.5;
    } else if (block.type === "table") {
      ensureSpace(20);
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX, bottom: 18 },
        head: [block.headers],
        body: block.rows,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        styles: {
          font: "helvetica",
          fontSize: 8.2,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          overflow: "linebreak",
        },
      });
      const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
      y = (finalY ?? y + 15) + 6;
    } else if (block.type === "list") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      doc.setTextColor(30, 41, 59);
      block.items.forEach((item, idx) => {
        const prefix = block.ordered ? `${idx + 1}. ` : "• ";
        const wrapped = doc.splitTextToSize(prefix + item, contentWidth - 4);
        ensureSpace(wrapped.length * 4.5 + 2);
        doc.text(wrapped, marginX + 2, y);
        y += wrapped.length * 4.5 + 1.5;
      });
      y += 2;
    } else if (block.type === "paragraph") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      doc.setTextColor(51, 65, 85);
      const wrapped = doc.splitTextToSize(block.text, contentWidth);
      ensureSpace(wrapped.length * 4.6 + 3);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 4.6 + 2.5;
    }
  }

  // Rodapé com paginação em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Documento gerado pelo Assistente Empresarial Tercerize · ${input.tenantName} (${title.slice(0, 42)})`,
      marginX,
      pageHeight - 8.5,
    );
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 8.5, { align: "right" });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-${slugifyFile(input.tenantName)}-${dateStamp}.pdf`);
}

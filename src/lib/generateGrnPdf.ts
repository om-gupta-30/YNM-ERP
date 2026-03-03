import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GRN, GRNItem, GateEntry, Supplier, Item, PurchaseOrder } from "@/lib/types";

type POItemRow = {
  itemId: string;
  unitPrice: number;
  taxPercent: number;
  totalAmount: number;
};

export type GrnPdfData = {
  grn: GRN;
  grnItems: GRNItem[];
  gateEntry: GateEntry | null;
  po: PurchaseOrder | null;
  supplier: Supplier | null;
  items: Map<string, Item>;
  poItems: POItemRow[];
};

export function generateGrnPdf(data: GrnPdfData) {
  const { grn, grnItems, gateEntry, po, supplier, items, poItems } = data;
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const poItemMap = new Map(poItems.map((p) => [p.itemId, p]));

  // ── Company Header ──────────────────────────────────────────────────
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("YNM PAN GLOBAL TRADE PVT. LTD.", pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Sy. No. 191 & 192, Plot No. 128, Mankhal, Maheswaram, R.R. District, Telangana - 501 359",
    pageWidth / 2,
    19,
    { align: "center" },
  );
  doc.text("GSTIN: 36AABCY1234F1ZP  |  CIN: U74999TG2020PTC123456", pageWidth / 2, 24, {
    align: "center",
  });

  y = 36;

  // ── Title ───────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(245, 245, 244);
  doc.rect(margin, y, contentWidth, 9, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("GOODS RECEIPT NOTE", pageWidth / 2, y + 6.5, { align: "center" });
  y += 13;

  // ── Two-column info block ──────────────────────────────────────────
  const colW = contentWidth / 2 - 2;
  const leftX = margin;
  const rightX = margin + colW + 4;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftX, y, colW, 40, 1, 1, "S");
  doc.roundedRect(rightX, y, colW, 40, 1, 1, "S");

  // Left: Supplier info
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 113, 108);
  doc.text("SUPPLIER DETAILS", leftX + 3, y + 5);

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(supplier?.supplierName ?? "—", leftX + 3, y + 11);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(68, 64, 60);

  const supplierAddr = supplier?.address ?? "—";
  const addrLines = doc.splitTextToSize(supplierAddr, colW - 6);
  doc.text(addrLines, leftX + 3, y + 16);

  const addrEnd = y + 16 + addrLines.length * 3;
  doc.text(`GSTIN: ${supplier?.gstNumber ?? "—"}`, leftX + 3, addrEnd + 2);
  doc.text(`Contact: ${supplier?.contactPerson ?? "—"}  |  Phone: ${supplier?.phone ?? "—"}`, leftX + 3, addrEnd + 6);
  doc.text(`Terms: ${supplier?.paymentTerms ?? "—"}`, leftX + 3, addrEnd + 10);

  // Right: GRN / PO details
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 113, 108);
  doc.text("DOCUMENT DETAILS", rightX + 3, y + 5);

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const details: [string, string][] = [
    ["GRN No:", grn.grnNumber],
    ["PO No:", po?.poNumber ?? "—"],
    ["Gate Entry:", gateEntry?.gateEntryNumber ?? "—"],
    ["DC / Challan:", gateEntry?.invoiceNumber ?? "—"],
    ["Vehicle No:", gateEntry?.vehicleNumber ?? "—"],
    ["Status:", grn.status],
    ["Date:", new Date(grn.createdAt).toLocaleDateString("en-IN")],
    ["Factory:", grn.factory ?? "—"],
  ];

  let dy = y + 10;
  for (const [label, val] of details) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(87, 83, 78);
    doc.text(label, rightX + 3, dy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(val, rightX + 28, dy);
    dy += 4;
  }

  y += 44;

  // ── Items Table ─────────────────────────────────────────────────────
  const tableBody: (string | number)[][] = [];
  let grandTotal = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalOrdered = 0;

  grnItems.forEach((line, idx) => {
    const item = items.get(line.itemId);
    const poItem = poItemMap.get(line.itemId);
    const rate = poItem?.unitPrice ?? 0;
    const lineTotal = rate * line.acceptedQty;
    grandTotal += lineTotal;
    totalAccepted += line.acceptedQty;
    totalRejected += line.rejectedQty;
    totalOrdered += line.orderedQty;

    tableBody.push([
      idx + 1,
      item?.itemCode ?? "—",
      item?.itemName ?? "—",
      item?.uom ?? "NOS",
      rate > 0 ? `₹${rate.toFixed(2)}` : "—",
      line.orderedQty,
      line.receivedQty,
      line.acceptedQty,
      line.rejectedQty,
      lineTotal > 0 ? `₹${lineTotal.toFixed(2)}` : "—",
    ]);
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        { content: "#", styles: { halign: "center" } },
        "Code",
        "Material Name",
        "UOM",
        { content: "Rate", styles: { halign: "right" } },
        { content: "PO Qty", styles: { halign: "right" } },
        { content: "Recd", styles: { halign: "right" } },
        { content: "Accepted", styles: { halign: "right" } },
        { content: "Rejected", styles: { halign: "right" } },
        { content: "Amount", styles: { halign: "right" } },
      ],
    ],
    body: tableBody,
    foot: [
      [
        { content: "", colSpan: 4 },
        { content: "TOTAL", styles: { halign: "right", fontStyle: "bold" } },
        { content: String(totalOrdered), styles: { halign: "right", fontStyle: "bold" } },
        "",
        { content: String(totalAccepted), styles: { halign: "right", fontStyle: "bold" } },
        { content: String(totalRejected), styles: { halign: "right", fontStyle: "bold" } },
        {
          content: grandTotal > 0 ? `₹${grandTotal.toFixed(2)}` : "—",
          styles: { halign: "right", fontStyle: "bold" },
        },
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [41, 37, 36],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [28, 25, 23],
    },
    footStyles: {
      fillColor: [245, 245, 244],
      textColor: [28, 25, 23],
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 18 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 14, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 22, halign: "right" },
    },
    didDrawPage: () => {
      // page number footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: "center" },
      );
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Grand Total Box ─────────────────────────────────────────────────
  if (grandTotal > 0) {
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(pageWidth - margin - 65, y, 65, 12, 1, 1, "F");
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.roundedRect(pageWidth - margin - 65, y, 65, 12, 1, 1, "S");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(87, 83, 78);
    doc.text("Grand Total (Accepted):", pageWidth - margin - 62, y + 5);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(6, 95, 70);
    doc.text(`₹${grandTotal.toFixed(2)}`, pageWidth - margin - 3, y + 10, { align: "right" });
    y += 16;
  }

  // ── Check if we need a new page for signatures ─────────────────────
  const remainingSpace = doc.internal.pageSize.getHeight() - y;
  if (remainingSpace < 60) {
    doc.addPage();
    y = margin;
  }

  // ── Signature Block ─────────────────────────────────────────────────
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  const sigW = contentWidth / 3 - 2;
  const sigs = [
    { title: "Revised by Stores", sub: "Stores Department" },
    { title: "Inspected by QC", sub: "Quality Control" },
    { title: "Entered into Stocks", sub: "Stock Entry" },
  ];

  sigs.forEach((sig, idx) => {
    const sx = margin + idx * (sigW + 3);

    doc.setFillColor(250, 250, 249);
    doc.roundedRect(sx, y, sigW, 28, 1, 1, "F");
    doc.setDrawColor(214, 211, 209);
    doc.roundedRect(sx, y, sigW, 28, 1, 1, "S");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(87, 83, 78);
    doc.text(sig.title.toUpperCase(), sx + 3, y + 5);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(sig.sub, sx + 3, y + 9);

    // Signature line
    doc.setDrawColor(168, 162, 158);
    doc.setLineWidth(0.2);
    doc.line(sx + 3, y + 19, sx + sigW - 3, y + 19);

    doc.setFontSize(6);
    doc.text("Signature", sx + 3, y + 22);
    doc.text("Date: ____/____/______", sx + 3, y + 26);
  });

  y += 34;

  // ── Additional Info ─────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 18, 1, 1, "S");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 113, 108);
  doc.text("TRANSPORT & ADDITIONAL INFO", margin + 3, y + 5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(68, 64, 60);
  doc.text(`Vehicle No: ${gateEntry?.vehicleNumber ?? "—"}`, margin + 3, y + 10);
  doc.text(`Freight Amount: ____________`, margin + 60, y + 10);
  doc.text(`LR/RR No: ____________`, margin + 120, y + 10);
  doc.text(`Transporter: ____________`, margin + 3, y + 15);
  doc.text(`E-Way Bill: ${gateEntry?.ewayBillNumber || "—"}`, margin + 60, y + 15);

  // ── Footer line ─────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY, margin + contentWidth, footerY);
  doc.setFontSize(6);
  doc.setTextColor(168, 162, 158);
  doc.text("This is a system generated document from YNM ERP.", pageWidth / 2, footerY + 3, {
    align: "center",
  });
  doc.text(
    `Generated on: ${new Date().toLocaleString("en-IN")}`,
    pageWidth / 2,
    footerY + 6,
    { align: "center" },
  );

  return doc;
}

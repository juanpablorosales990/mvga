import type { TFunction } from 'i18next';

interface PdfTransaction {
  timestamp: number;
  type: string;
  isOutgoing?: boolean;
  amount?: number;
  token?: string;
  counterparty?: string;
  status?: string;
}

export async function exportTransactionsPdf(
  transactions: PdfTransaction[],
  walletAddress: string,
  t: TFunction
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFontSize(22);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text('MVGA', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text(t('history.title'), 14, 26);

  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString(), pageWidth - 14, 18, { align: 'right' });
  doc.text(`${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}`, pageWidth - 14, 24, {
    align: 'right',
  });

  // --- Summary ---
  const inflows = transactions.filter((tx) => tx.isOutgoing === false);
  const outflows = transactions.filter((tx) => tx.isOutgoing === true);
  const inflowTotal = inflows.reduce((s, tx) => s + (tx.amount || 0), 0);
  const outflowTotal = outflows.reduce((s, tx) => s + (tx.amount || 0), 0);

  let y = 42;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${t('history.pdfTotal')}: ${transactions.length}  |  ${t('history.pdfIn')}: ${inflows.length} (${inflowTotal.toLocaleString(undefined, { maximumFractionDigits: 4 })})  |  ${t('history.pdfOut')}: ${outflows.length} (${outflowTotal.toLocaleString(undefined, { maximumFractionDigits: 4 })})`,
    14,
    y
  );
  y += 6;

  // --- Table ---
  const head = [
    [
      t('history.pdfDate'),
      t('history.pdfType'),
      t('history.pdfDirection'),
      t('history.pdfAmount'),
      t('history.pdfToken'),
      t('history.pdfCounterparty'),
      t('history.pdfStatus'),
    ],
  ];

  const body = transactions.map((tx) => [
    new Date(tx.timestamp * 1000).toLocaleDateString(),
    tx.type,
    tx.isOutgoing === false ? 'IN' : tx.isOutgoing ? 'OUT' : '-',
    tx.amount != null ? tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '-',
    tx.token || '-',
    tx.counterparty ? `${tx.counterparty.slice(0, 6)}...${tx.counterparty.slice(-4)}` : '-',
    tx.status || 'CONFIRMED',
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [212, 175, 55],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7, textColor: [60, 60, 60] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: { pageNumber: number }) => {
      // Footer on every page
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `mvga.io — ${t('history.pdfPage')} ${data.pageNumber}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    },
  });

  doc.save(`mvga-transactions-${new Date().toISOString().slice(0, 10)}.pdf`);
}

import type { TFunction } from 'i18next';

export interface ReceiptData {
  signature: string;
  timestamp: number; // Unix seconds
  type: string;
  amount: number;
  token: string;
  status?: string;
  isOutgoing?: boolean;
  counterparty?: string;
  fee?: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1200;
const GOLD = '#f59e0b';
const BG = '#1a1a1a';
const WHITE = '#ffffff';
const GRAY = 'rgba(255,255,255,0.4)';

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function generateReceipt(
  data: ReceiptData,
  walletAddress: string,
  t: TFunction
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Header — Gold bar
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 6);

  // Logo text
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MVGA', CANVAS_WIDTH / 2, 80);

  // Subtitle
  ctx.fillStyle = GRAY;
  ctx.font = '18px monospace';
  ctx.fillText(t('receipt.title'), CANVAS_WIDTH / 2, 115);

  // Horizontal separator
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 145);
  ctx.lineTo(CANVAS_WIDTH - 60, 145);
  ctx.stroke();

  // Transaction details
  let y = 200;
  const leftX = 80;
  const rightX = CANVAS_WIDTH - 80;
  const lineHeight = 65;

  const drawRow = (label: string, value: string, valueColor = WHITE) => {
    ctx.fillStyle = GRAY;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, leftX, y);
    ctx.fillStyle = valueColor;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(value, rightX, y);
    y += lineHeight;
  };

  // Date
  drawRow(t('receipt.date'), formatDate(data.timestamp));

  // Type
  drawRow(t('receipt.type'), data.type);

  // Amount — big and gold
  ctx.fillStyle = GRAY;
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(t('receipt.amount'), leftX, y);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'right';
  const sign = data.isOutgoing ? '-' : '+';
  ctx.fillText(
    `${sign}${data.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${data.token}`,
    rightX,
    y + 4
  );
  y += 80;

  // Counterparty
  if (data.counterparty) {
    const label = data.isOutgoing ? t('receipt.recipient') : t('receipt.sender');
    drawRow(label, truncateAddress(data.counterparty));
  }

  // Status
  if (data.status) {
    const statusColor = data.status === 'CONFIRMED' ? '#22c55e' : GOLD;
    drawRow(t('receipt.status'), data.status, statusColor);
  }

  // Fee
  if (data.fee !== undefined && data.fee > 0) {
    drawRow(t('receipt.fee'), `~${data.fee} SOL`);
  }

  // Separator
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(60, y);
  ctx.lineTo(CANVAS_WIDTH - 60, y);
  ctx.stroke();
  y += 40;

  // Signature
  ctx.fillStyle = GRAY;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(t('receipt.signature'), leftX, y);
  y += 30;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '14px monospace';
  ctx.fillText(data.signature.slice(0, 44), leftX, y);
  y += 20;
  if (data.signature.length > 44) {
    ctx.fillText(data.signature.slice(44), leftX, y);
  }

  // Footer
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, CANVAS_HEIGHT - 6, CANVAS_WIDTH, 6);

  ctx.fillStyle = GRAY;
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(t('receipt.footer'), CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '13px monospace';
  ctx.fillText(truncateAddress(walletAddress), CANVAS_WIDTH / 2, CANVAS_HEIGHT - 55);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate receipt'));
    }, 'image/png');
  });
}

export async function shareReceipt(
  data: ReceiptData,
  walletAddress: string,
  t: TFunction
): Promise<'shared' | 'downloaded'> {
  const blob = await generateReceipt(data, walletAddress, t);
  const file = new File([blob], `mvga-receipt-${data.signature.slice(0, 8)}.png`, {
    type: 'image/png',
  });

  // Try Web Share API (mobile)
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `MVGA Receipt — ${data.amount} ${data.token}`,
      files: [file],
    });
    return 'shared';
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

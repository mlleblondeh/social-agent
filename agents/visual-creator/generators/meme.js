const { createCanvas } = require('canvas');
const config = require('../config');

const { width, height } = config.dimensions.square;

// Meme format layouts
const memeLayouts = {
  'nobody': {
    name: 'Nobody: Me:',
    regions: [
      { key: 'nobody', x: 100, y: 200, width: 880, height: 100, align: 'left', prefix: 'nobody:' },
      { key: 'me', x: 100, y: 500, width: 880, height: 300, align: 'left', prefix: 'me:' }
    ]
  },
  'drake': {
    name: 'Drake Pointing',
    regions: [
      { key: 'position1', x: 340, y: 150, width: 640, height: 340, align: 'left', indicator: 'reject' },
      { key: 'position2', x: 340, y: 590, width: 640, height: 340, align: 'left', indicator: 'approve' }
    ],
    divider: { y: 540 },
    indicatorWidth: 240
  },
  'buttons': {
    name: 'Two Buttons',
    regions: [
      { key: 'position1', x: 100, y: 200, width: 400, height: 300, align: 'center', box: true },
      { key: 'position2', x: 580, y: 200, width: 400, height: 300, align: 'center', box: true }
    ],
    footer: { y: 700, text: '[sweating intensifies]' }
  },
  'distracted': {
    name: 'Distracted Boyfriend',
    regions: [
      { key: 'position1', x: 700, y: 100, width: 300, height: 200, align: 'center', label: 'other woman' },
      { key: 'position2', x: 400, y: 400, width: 300, height: 200, align: 'center', label: 'boyfriend' },
      { key: 'position3', x: 100, y: 700, width: 300, height: 200, align: 'center', label: 'girlfriend' }
    ]
  },
  'default': {
    name: 'Generic Two-Panel',
    regions: [
      { key: 'position1', x: 100, y: 150, width: 880, height: 350, align: 'center' },
      { key: 'position2', x: 100, y: 600, width: 880, height: 350, align: 'center' }
    ],
    divider: { y: 540 }
  }
};

function detectMemeFormat(formatName) {
  const lower = (formatName || '').toLowerCase();

  if (lower.includes('nobody') || lower.includes('me:')) return 'nobody';
  if (lower.includes('drake') || lower.includes('pointing')) return 'drake';
  if (lower.includes('button') || lower.includes('two button')) return 'buttons';
  if (lower.includes('distract') || lower.includes('boyfriend')) return 'distracted';

  return 'default';
}

function applyGradientBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, config.colors.dark);
  gradient.addColorStop(1, config.colors.primary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawTextInRegion(ctx, text, region, fontSize) {
  const font = config.fonts.meme;
  ctx.font = `${font.weight} ${fontSize}px ${font.family}`;
  ctx.fillStyle = config.colors.text;
  ctx.textBaseline = 'top';

  const fullText = region.prefix ? `${region.prefix} ${text}` : text;
  const lines = wrapText(ctx, fullText, region.width - 40);
  const lineHeight = fontSize * font.lineHeight;
  const totalHeight = lines.length * lineHeight;

  let startY = region.y + (region.height - totalHeight) / 2;

  ctx.textAlign = region.align || 'center';
  const x = region.align === 'left' ? region.x + 20 :
            region.align === 'right' ? region.x + region.width - 20 :
            region.x + region.width / 2;

  for (const line of lines) {
    ctx.fillText(line, x, startY);
    startY += lineHeight;
  }
}

function drawBox(ctx, x, y, w, h) {
  ctx.strokeStyle = config.colors.accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
}

function drawIndicator(ctx, type, x, y, size) {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (type === 'reject') {
    ctx.fillStyle = '#EF4444';
    ctx.fillText('✗', x, y);
  } else if (type === 'approve') {
    ctx.fillStyle = '#22C55E';
    ctx.fillText('✓', x, y);
  }
}

function generateMeme(content) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Apply gradient background
  applyGradientBackground(ctx);

  // Detect meme format
  const formatName = content.concept?.meme_format || '';
  const formatKey = detectMemeFormat(formatName);
  const layout = memeLayouts[formatKey];

  // Get labels from content
  const labels = content.concept?.labels || {};

  // Draw divider if present
  if (layout.divider) {
    ctx.strokeStyle = config.colors.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, layout.divider.y);
    ctx.lineTo(width - 50, layout.divider.y);
    ctx.stroke();
  }

  // Draw each region
  for (const region of layout.regions) {
    const text = labels[region.key] || '';

    if (!text) continue;

    // Draw box if needed
    if (region.box) {
      drawBox(ctx, region.x, region.y, region.width, region.height);
    }

    // Draw indicator (for Drake format)
    if (region.indicator && layout.indicatorWidth) {
      const indicatorX = layout.indicatorWidth / 2;
      const indicatorY = region.y + region.height / 2;
      drawIndicator(ctx, region.indicator, indicatorX, indicatorY, 80);
    }

    // Calculate font size based on text length
    const fontSize = text.length > 100 ? 28 :
                     text.length > 50 ? 32 :
                     36;

    drawTextInRegion(ctx, text, region, fontSize);
  }

  // Draw footer if present
  if (layout.footer) {
    ctx.font = `italic 24px ${config.fonts.meme.family}`;
    ctx.fillStyle = config.colors.accent;
    ctx.textAlign = 'center';
    ctx.fillText(layout.footer.text, width / 2, layout.footer.y);
  }

  // Draw format label in corner
  ctx.font = '16px sans-serif';
  ctx.fillStyle = config.colors.accent;
  ctx.globalAlpha = 0.5;
  ctx.textAlign = 'right';
  ctx.fillText(`[${layout.name}]`, width - 20, height - 20);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

module.exports = { generateMeme, detectMemeFormat };

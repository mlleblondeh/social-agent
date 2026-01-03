const { createCanvas } = require('canvas');
const config = require('../config');

const { width, height } = config.dimensions.square;

function getStyle(styleName) {
  return config.styles[styleName] || config.styles[config.defaultStyle];
}

function applyBackground(ctx, style) {
  if (style.solid) {
    ctx.fillStyle = style.solid;
    ctx.fillRect(0, 0, width, height);
  } else if (style.gradient) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, style.gradient[0]);
    gradient.addColorStop(1, style.gradient[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
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

function generateQuoteCard(content) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Get style based on design_style from content
  const styleName = content.concept?.design_style || config.defaultStyle;
  const style = getStyle(styleName);

  // Apply background
  applyBackground(ctx, style);

  // Extract quote and attribution
  const quote = content.concept?.quote || '';
  const attribution = content.concept?.attribution || '';

  // Configure quote text
  const quoteFont = config.fonts.quote;
  ctx.font = `${quoteFont.weight} ${quoteFont.size}px ${quoteFont.family}`;
  ctx.fillStyle = style.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate text layout
  const padding = 100;
  const maxTextWidth = width - (padding * 2);

  // Wrap quote text
  const quoteLines = wrapText(ctx, `"${quote}"`, maxTextWidth);

  // Calculate total height needed
  const quoteLineHeight = quoteFont.size * quoteFont.lineHeight;
  const attrFont = config.fonts.attribution;
  const totalQuoteHeight = quoteLines.length * quoteLineHeight;
  const attrHeight = attribution ? attrFont.size * 2 : 0;
  const totalHeight = totalQuoteHeight + attrHeight;

  // Start position (centered vertically)
  let y = (height - totalHeight) / 2 + quoteFont.size / 2;

  // Draw quote lines
  for (const line of quoteLines) {
    ctx.fillText(line, width / 2, y);
    y += quoteLineHeight;
  }

  // Draw attribution if present
  if (attribution) {
    ctx.font = `${attrFont.weight} ${attrFont.size}px ${attrFont.family}`;
    ctx.globalAlpha = 0.8;
    y += 20; // Gap before attribution
    ctx.fillText(attribution, width / 2, y);
    ctx.globalAlpha = 1;
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateQuoteCard };

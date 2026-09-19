// Staging GUI painter. The caller owns the 384×128 canvas, texture and update cadence.
const DISPLAY = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
const NUMERALS = '"Avenir Next", "Segoe UI", Arial, sans-serif';
const NAME_WIDTH = 308;

function cutCornerPath(context, x, y, width, height, cut) {
  context.beginPath();
  context.moveTo(x + cut, y);
  context.lineTo(x + width - cut, y);
  context.lineTo(x + width, y + cut);
  context.lineTo(x + width, y + height - cut);
  context.lineTo(x + width - cut, y + height);
  context.lineTo(x + cut, y + height);
  context.lineTo(x, y + height - cut);
  context.lineTo(x, y + cut);
  context.closePath();
}

function nameLayout(context, label) {
  for (let size = 32; size >= 26; size -= 2) {
    context.font = `600 ${size}px ${DISPLAY}`;
    if (context.measureText(label).width <= NAME_WIDTH) return { lines: [label], size };
  }
  const words = label.split(/\s+/);
  for (let size = 24; size >= 18; size -= 2) {
    context.font = `600 ${size}px ${DISPLAY}`;
    let best = null;
    for (let cut = 1; cut < words.length; cut++) {
      const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
      const widths = lines.map(line => context.measureText(line).width);
      const widest = Math.max(...widths);
      if (widest <= NAME_WIDTH && (!best || widest < best.widest)) best = { lines, size, widest };
    }
    if (best) return best;
  }
  // Preserve the supplied name, including a long unbroken token; no truncation or renamed boss.
  return { lines: [label], size: 18 };
}

// 'plate' is the full world plate (name, bar, numbers). 'pip' is what stays in the world once the fixed DOM boss bar
// (src/ui/boss-bar.js) owns name and numbers: a thin health sliver under the boss accent, so several bosses remain
// distinguishable without a plate that can land on the HUD. The caller's canvas, texture and cadence do not change.
let worldPlateMode = 'plate';
export function setBossWorldPlateMode(mode) { worldPlateMode = mode === 'pip' ? 'pip' : 'plate'; }
export function getBossWorldPlateMode() { return worldPlateMode; }

function paintBossPip(context, ratio, accent) {
  const x = 112, y = 96, width = 160, height = 9;
  context.fillStyle = '#03090dd9';
  context.fillRect(x - 2, y - 2, width + 4, height + 4);
  context.strokeStyle = '#9b896999';
  context.lineWidth = 1;
  context.strokeRect(x - 1.5, y - 1.5, width + 3, height + 3);
  context.fillStyle = '#331b24';
  context.fillRect(x, y, width, height);
  const blood = context.createLinearGradient(0, y, 0, y + height);
  blood.addColorStop(0, '#d47378');
  blood.addColorStop(0.35, '#b33b48');
  blood.addColorStop(1, '#6c2230');
  context.fillStyle = blood;
  context.fillRect(x, y, width * ratio, height);
  context.beginPath();
  context.moveTo(192, y - 17); context.lineTo(199, y - 9); context.lineTo(192, y - 1); context.lineTo(185, y - 9); context.closePath();
  context.fillStyle = '#0a1319'; context.fill();
  context.strokeStyle = accent || '#b39a6e'; context.lineWidth = 2; context.stroke();
}

export function paintBossLabel(context, { label, health, maxHealth, healthRatio, accent }) {
  const ratio = healthRatio ?? Math.max(0, Math.min(1, health / maxHealth));
  const valueText = `${Math.ceil(health)} / ${Math.ceil(maxHealth)}`;
  const name = String(label ?? '');
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.shadowBlur = 0;
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  if (worldPlateMode === 'pip') {
    paintBossPip(context, ratio, accent);
    context.restore();
    return { label: name, nameLines: [], nameFontSize: 0, valueText, healthRatio: ratio, barWidth: 160 * ratio, mode: 'pip' };
  }

  // A narrow, worn metal bevel replaces the saturated rectangular perimeter.
  const metal = context.createLinearGradient(0, 14, 0, 114);
  metal.addColorStop(0, '#b39a6e');
  metal.addColorStop(0.22, '#6d6655');
  metal.addColorStop(0.55, '#373d3b');
  metal.addColorStop(1, '#827052');
  cutCornerPath(context, 16, 14, 352, 100, 8);
  context.fillStyle = metal;
  context.fill();

  const stone = context.createLinearGradient(0, 16, 0, 112);
  stone.addColorStop(0, '#19262c');
  stone.addColorStop(0.38, '#0c171e');
  stone.addColorStop(1, '#071117');
  cutCornerPath(context, 18, 16, 348, 96, 7);
  context.fillStyle = stone;
  context.fill();
  cutCornerPath(context, 22.5, 20.5, 339, 87, 5);
  context.strokeStyle = '#56615a66';
  context.lineWidth = 1;
  context.stroke();

  const layout = nameLayout(context, name);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `600 ${layout.size}px ${DISPLAY}`;
  context.fillStyle = '#f2e4cd';
  for (let i = 0; i < layout.lines.length; i++) {
    context.fillText(layout.lines[i], 192, layout.lines.length === 1 ? 40 : 29 + i * 23, NAME_WIDTH);
  }

  // The channel remains visible at low health. No glow extends outside the label footprint.
  context.fillStyle = '#03090d';
  context.fillRect(47, 67, 290, 21);
  context.strokeStyle = '#9b8969';
  context.lineWidth = 1;
  context.strokeRect(47.5, 67.5, 289, 20);
  context.fillStyle = '#331b24';
  context.fillRect(50, 70, 284, 15);
  const blood = context.createLinearGradient(0, 70, 0, 85);
  blood.addColorStop(0, '#d47378');
  blood.addColorStop(0.18, '#b33b48');
  blood.addColorStop(0.65, '#8c2837');
  blood.addColorStop(1, '#571f2b');
  context.fillStyle = blood;
  context.fillRect(50, 70, 284 * ratio, 15);
  if (ratio > 0) {
    context.fillStyle = '#efb6a566';
    context.fillRect(50, 70, 284 * ratio, 1);
  }

  for (const x of [35, 349]) {
    context.beginPath();
    context.moveTo(x, 72); context.lineTo(x + 5, 77.5);
    context.lineTo(x, 83); context.lineTo(x - 5, 77.5); context.closePath();
    context.fillStyle = '#7c6d52'; context.fill();
    context.beginPath();
    context.moveTo(x, 75); context.lineTo(x + 2.3, 77.5);
    context.lineTo(x, 80); context.lineTo(x - 2.3, 77.5); context.closePath();
    context.globalAlpha = 0.62;
    context.fillStyle = accent || '#b39a6e'; context.fill();
    context.globalAlpha = 1;
  }

  context.font = `600 19px ${NUMERALS}`;
  context.fillStyle = '#e5ddcd';
  context.fillText(valueText, 192, 101, 280);
  context.restore();
  return { label: name, nameLines: layout.lines, nameFontSize: layout.size, valueText, healthRatio: ratio, barWidth: 284 * ratio };
}

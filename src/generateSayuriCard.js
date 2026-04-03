/**
 * Carte Sayuri : paliers nommés + prérequis (rankConfig.js), progression selon heures vocales.
 * Images optionnelles : assets/sayuri_bg.png, assets/ranks/<id>.png
 */

const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { formatVocalHours, RANKS } = require('./rankConfig');
const { getEffectiveRankState } = require('./rankResolver');
const { resolvePanelRankState } = require('./panelRankResolver');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const RANKS_DIR = path.join(ASSETS, 'ranks');

const COLORS = {
  gold: '#E8C547',
  goldDeep: '#9A7B2C',
  goldLine: '#F5E6B3',
  pink: '#FFB7C5',
  ivory: '#FFF8F5',
  pillDark: 'rgba(25, 15, 22, 0.82)',
  blush: 'rgba(255, 230, 238, 0.35)',
  shadow: 'rgba(30, 12, 22, 0.55)',
};

/**
 * Stats affichées sur la carte (hors calcul auto rang).
 * `vocalHours` : nombre décimal d’heures (ex. 167.83) → rang + % via rankConfig.
 */
const mockRankData = {
  vocalHours: 167.83,
  messageCount: 4200,
  timeLeft: '117h10m1s',
  rankPos: '#58',
  voiceStatus: 'INACTIF',
  boostStatus: 'BOOST DÉSACTIVÉ',
};

async function tryLoadImage(filePath) {
  try {
    return await loadImage(filePath);
  } catch {
    return null;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFallbackBackground(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2d1520');
  g.addColorStop(0.35, '#5c2840');
  g.addColorStop(0.55, '#8b4a62');
  g.addColorStop(1, '#ffd6e0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 18; i++) {
    const cx = (i * 137) % W;
    const cy = (i * 89 + 40) % H;
    ctx.fillStyle = '#FFB7C5';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 10, 6, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, W, H);
}

function drawPillars(ctx, W, H) {
  const w = 48;
  const drawOne = (x) => {
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, 'rgba(212,175,55,0.15)');
    grad.addColorStop(0.5, 'rgba(255,183,197,0.2)');
    grad.addColorStop(1, 'rgba(212,175,55,0.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, H);
    ctx.strokeStyle = COLORS.goldDeep;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, 8, w - 8, H - 16);
    const gy = ctx.createRadialGradient(x + w / 2, 28, 2, x + w / 2, 28, 20);
    gy.addColorStop(0, 'rgba(255,220,180,0.65)');
    gy.addColorStop(1, 'rgba(255,183,197,0)');
    ctx.fillStyle = gy;
    ctx.beginPath();
    ctx.arc(x + w / 2, 28, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w / 2, H - 28, 14, 0, Math.PI * 2);
    ctx.fill();
  };
  drawOne(0);
  drawOne(W - w);
}

function drawCherryFlower(ctx, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.pink;
  ctx.strokeStyle = COLORS.goldLine;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -6, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#FFF5E6';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRankUpArrow(ctx, cx, cy) {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 220, 150, 0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.gold;
  ctx.strokeStyle = COLORS.goldDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx + 11, cy + 4);
  ctx.lineTo(cx + 4, cy + 4);
  ctx.lineTo(cx + 4, cy + 12);
  ctx.lineTo(cx - 4, cy + 12);
  ctx.lineTo(cx - 4, cy + 4);
  ctx.lineTo(cx - 11, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTitleBanner(ctx, W, y, bw, bh) {
  const x = (W - bw) / 2;
  const g = ctx.createLinearGradient(x, y, x, y + bh);
  g.addColorStop(0, COLORS.goldDeep);
  g.addColorStop(0.45, COLORS.gold);
  g.addColorStop(1, COLORS.goldDeep);
  ctx.beginPath();
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + bw - 16, y);
  ctx.quadraticCurveTo(x + bw, y, x + bw, y + 12);
  ctx.lineTo(x + bw - 8, y + bh - 10);
  ctx.quadraticCurveTo(x + bw - 20, y + bh + 6, W / 2, y + bh + 4);
  ctx.quadraticCurveTo(x + 20, y + bh + 6, x + 8, y + bh - 10);
  ctx.lineTo(x, y + 12);
  ctx.quadraticCurveTo(x, y, x + 16, y);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = COLORS.goldLine;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawUsernameRibbon(ctx, W, y, w, h, text) {
  const x = (W - w) / 2;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,240,245,0.25)');
  g.addColorStop(0.5, 'rgba(255,220,232,0.4)');
  g.addColorStop(1, 'rgba(255,240,245,0.25)');
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = COLORS.goldLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 17px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const t = text.length > 38 ? `${text.slice(0, 36)}…` : text;
  ctx.shadowColor = COLORS.shadow;
  ctx.shadowBlur = 4;
  ctx.fillText(t, W / 2, y + h / 2);
  ctx.restore();
}

function drawSectionLabel(ctx, cx, y, w, h, label) {
  const x = cx - w / 2;
  roundRect(ctx, x, y, w, h, 8);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#6b4a1e');
  grad.addColorStop(0.5, COLORS.goldDeep);
  grad.addColorStop(1, '#5a3d18');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = COLORS.goldLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORS.ivory;
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, y + h / 2);
}

function drawRankFrame(ctx, x, y, size) {
  ctx.save();
  ctx.strokeStyle = COLORS.goldDeep;
  ctx.lineWidth = 4;
  roundRect(ctx, x, y, size, size, 6);
  ctx.stroke();
  ctx.strokeStyle = COLORS.goldLine;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 5, y + 5, size - 10, size - 10, 4);
  ctx.stroke();
  const ig = ctx.createLinearGradient(x, y, x + size, y + size);
  ig.addColorStop(0, 'rgba(40,20,30,0.55)');
  ig.addColorStop(1, COLORS.blush);
  roundRect(ctx, x + 8, y + 8, size - 16, size - 16, 3);
  ctx.fillStyle = ig;
  ctx.fill();
  ctx.restore();
}

/** Découpe un texte en lignes selon la largeur (mesure ctx.measureText). */
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Panneau gauche : palier actuel (nom + seuil).
 */
function drawCurrentRankPanel(ctx, ix, iy, inner, current, img) {
  if (img) {
    ctx.save();
    roundRect(ctx, ix, iy, inner, inner, 3);
    ctx.clip();
    ctx.drawImage(img, ix, iy, inner, inner);
    ctx.restore();
    const ov = ctx.createLinearGradient(ix, iy + inner * 0.45, ix, iy + inner);
    ov.addColorStop(0, 'rgba(0,0,0,0)');
    ov.addColorStop(1, 'rgba(20,8,14,0.88)');
    ctx.fillStyle = ov;
    roundRect(ctx, ix, iy + inner * 0.38, inner, inner * 0.62, 3);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px "Times New Roman", Georgia, serif';
  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(current.name, ix + inner / 2, iy + inner * (img ? 0.72 : 0.42));
  ctx.shadowBlur = 0;
  ctx.font = '600 11px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.ivory;
  const seuilLine =
    current.minMessages != null && current.minMessages !== undefined
      ? `≥ ${Number(current.minMessages).toLocaleString('fr-FR')} msgs · ${current.minVocalHours} h vocal`
      : `Seuil : ≥ ${current.minVocalHours} h vocales`;
  ctx.fillText(seuilLine, ix + inner / 2, iy + inner * (img ? 0.88 : 0.62));
  if (!img) {
    ctx.font = 'italic 10px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,248,245,0.65)';
    ctx.fillText('Palier actuel', ix + inner / 2, iy + inner * 0.78);
  }
}

/**
 * Panneau droit : prochain palier + liste des prérequis (ou état max).
 */
function drawNextRankPanel(ctx, ix, iy, inner, next, isMax, img, vocalHours, messageCount = 0) {
  if (isMax) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px "Times New Roman", Georgia, serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText('Palier maximum', ix + inner / 2, iy + inner * 0.38);
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.ivory;
    ctx.fillText('Dernier palier', ix + inner / 2, iy + inner * 0.55);
    ctx.fillText('atteint.', ix + inner / 2, iy + inner * 0.68);
    return;
  }

  let top = iy + 6;
  const imgH = img ? Math.min(inner * 0.38, 68) : 0;
  if (img) {
    ctx.save();
    roundRect(ctx, ix + 4, top, inner - 8, imgH, 4);
    ctx.clip();
    ctx.drawImage(img, ix + 4, top, inner - 8, imgH);
    ctx.restore();
    top += imgH + 6;
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 19px "Times New Roman", Georgia, serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(next.name, ix + inner / 2, top + 12);
  top += 28;

  ctx.textAlign = 'left';
  ctx.font = 'bold 9px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.pink;
  ctx.fillText('PRÉREQUIS', ix + 8, top);
  top += 14;

  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,248,245,0.9)';
  const maxW = inner - 16;
  const lineH = 12;
  const maxY = iy + inner - 4;

  for (const req of next.requis) {
    const bullet = `• ${req}`;
    const lines = wrapLines(ctx, bullet, maxW);
    for (const line of lines) {
      if (top > maxY) return;
      ctx.fillText(line, ix + 8, top);
      top += lineH;
    }
    top += 2;
  }

  ctx.textAlign = 'center';
  ctx.font = 'italic 9px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,183,197,0.85)';
  if (top < maxY - 10) {
    if (next.minMessages != null && next.minMessages !== undefined) {
      const needM = Math.max(0, next.minMessages - messageCount);
      const needV = Math.max(0, next.minVocalHours - vocalHours);
      ctx.fillText(
        `Manque ~${needM.toLocaleString('fr-FR')} msgs · ~${needV.toFixed(1)} h vocal`,
        ix + inner / 2,
        maxY - 4,
      );
    } else {
      const need = Math.max(0, next.minVocalHours - vocalHours);
      if (need > 0) {
        ctx.fillText(`Encore ~${need.toFixed(1)} h vocales pour le palier`, ix + inner / 2, maxY - 4);
      }
    }
  }
}

function drawStatusPill(ctx, cx, y, w, h, text) {
  const x = cx - w / 2;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = COLORS.pillDark;
  ctx.fill();
  ctx.strokeStyle = COLORS.goldDeep;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2);
}

function drawProgressBlock(ctx, cx, barW, barH, barY, pct, labelPct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const barX = cx - barW / 2;
  roundRect(ctx, barX, barY, barW, barH, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.stroke();
  const pad = 3;
  const innerW = barW - pad * 2;
  const innerH = barH - pad * 2;
  const fillW = Math.max(2, (innerW * p) / 100);
  roundRect(ctx, barX + pad, barY + pad, fillW, innerH, 7);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();

  ctx.fillStyle = COLORS.ivory;
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(labelPct ?? `${Math.round(p)}%`, cx, barY - 6);
}

function drawHourglass(ctx, cx, cy, h) {
  const w = h * 0.55;
  ctx.save();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy + h / 2);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,183,197,0.35)';
  ctx.fill();
  ctx.restore();
}

function drawStatsPanel(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 14);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(55, 32, 42, 0.95)');
  g.addColorStop(0.5, 'rgba(40, 24, 34, 0.96)');
  g.addColorStop(1, 'rgba(70, 40, 52, 0.92)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = COLORS.goldDeep;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = COLORS.goldLine;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 10);
  ctx.stroke();
}

/**
 * @param {import('discord.js').GuildMember | null} member
 * @param {{
 *   vocalHours?: number,
 *   timeLeft?: string,
 *   rankPos?: string,
 *   voiceStatus?: string,
 *   boostStatus?: string,
 *   username?: string
 * }} data
 * @param {{ roles?: Record<string, string>, tierOverrides?: Record<string, { name?: string, requis?: string[] }>, panelRanks?: { roleId: string, minMessages: number, minVocalHours: number }[] }} [guildConfig]
 * @param {import('discord.js').Guild | null} [guild] — requis si panelRanks est utilisé (noms de rôles).
 */
async function generateSayuriCard(member, data, guildConfig = {}, guild = null) {
  const W = 1000;
  const H = 640;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const vocalHours = Math.max(0, Number(data.vocalHours) ?? 0);
  const messageCount = Math.max(0, Math.floor(Number(data.messageCount) || 0));

  const panelRanks = guildConfig.panelRanks;
  const usePanel = Array.isArray(panelRanks) && panelRanks.length > 0;

  const state = usePanel
    ? resolvePanelRankState(guild ?? null, vocalHours, messageCount, panelRanks, member)
    : (() => {
        const s = getEffectiveRankState(member, vocalHours, guildConfig);
        return {
          mergedCurrent: s.mergedCurrent,
          mergedNext: s.mergedNext,
          percent: s.percent,
          isMax: s.isMax,
          current: s.current,
          next: s.next,
        };
      })();

  const bgPath = path.join(ASSETS, 'sayuri_bg.png');
  const curId = usePanel ? state.mergedCurrent.id : state.current?.id ?? 'shiro';
  const currentImgPath = path.join(RANKS_DIR, `${curId}.png`);
  const nextId = state.mergedNext?.id;
  const nextImgPath = nextId && nextId !== 'none' ? path.join(RANKS_DIR, `${nextId}.png`) : null;

  const bg = await tryLoadImage(bgPath);
  const imgCurrent = await tryLoadImage(currentImgPath);
  const imgNext = nextImgPath ? await tryLoadImage(nextImgPath) : null;

  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
    ctx.fillStyle = 'rgba(35, 18, 28, 0.38)';
    ctx.fillRect(0, 0, W, H);
  } else {
    drawFallbackBackground(ctx, W, H);
  }

  drawPillars(ctx, W, H);

  const midX = W / 2;
  drawCherryFlower(ctx, midX - 52, 26, 0.9);
  drawCherryFlower(ctx, midX + 52, 26, 0.9);
  drawRankUpArrow(ctx, midX, 22);

  drawTitleBanner(ctx, W, 44, 620, 52);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px "Times New Roman", Georgia, serif';
  ctx.fillStyle = '#3d2914';
  ctx.fillText('SAYURI RANKUP', midX + 1, 72 + 1);
  ctx.fillStyle = COLORS.ivory;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 3;
  ctx.fillText('SAYURI RANKUP', midX, 71);
  ctx.restore();

  const displayName =
    member?.displayName ?? member?.user?.username ?? data.username ?? 'Utilisateur';
  drawUsernameRibbon(ctx, W, 104, 580, 34, displayName);

  const rankSize = 198;
  const rankTop = 168;
  const leftCx = 72 + rankSize / 2;
  const rightCx = W - 72 - rankSize / 2;

  drawSectionLabel(ctx, leftCx, rankTop - 34, rankSize + 14, 26, 'TON PALIER ACTUEL');
  drawSectionLabel(ctx, rightCx, rankTop - 34, rankSize + 14, 26, 'PROCHAIN PALIER');

  const rankLeftX = 72;
  const rankRightX = W - 72 - rankSize;
  drawRankFrame(ctx, rankLeftX, rankTop, rankSize);
  drawRankFrame(ctx, rankRightX, rankTop, rankSize);

  const inner = rankSize - 16;
  const ixL = rankLeftX + 8;
  const iy = rankTop + 8;
  const ixR = rankRightX + 8;

  drawCurrentRankPanel(ctx, ixL, iy, inner, state.mergedCurrent, imgCurrent);
  drawNextRankPanel(ctx, ixR, iy, inner, state.mergedNext, state.isMax, imgNext, vocalHours, messageCount);

  const voiceLabel = data.voiceStatus ?? 'INACTIF';
  const boostLabel = state.isMax ? 'PALIER MAX' : data.boostStatus ?? 'BOOST DÉSACTIVÉ';
  drawStatusPill(ctx, midX, 152, 140, 28, voiceLabel);

  const barY = 388;
  const barW = 400;
  const barH = 22;
  const pctLabel = state.isMax
    ? '100% · Max'
    : `${Math.round(state.percent)}% vers ${state.mergedNext?.name ?? ''}`;
  drawProgressBlock(ctx, midX, barW, barH, barY, state.isMax ? 100 : state.percent, pctLabel);

  drawStatusPill(ctx, midX, barY + barH + 12, 220, 26, boostLabel);

  const panelX = 52;
  const panelY = 432;
  const panelW = W - 104;
  const panelH = H - panelY - 20;
  drawStatsPanel(ctx, panelX, panelY, panelW, panelH);

  const hx = panelX + 52;
  const hy = panelY + panelH / 2;
  drawHourglass(ctx, hx, hy, 72);

  const tx = panelX + 100;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '500 16px "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.ivory;
  const vocalStr = formatVocalHours(vocalHours);
  const nextName = state.mergedNext ? state.mergedNext.name : '—';
  const l1 = `Prochain palier (${nextName}) dans : ${data.timeLeft ?? '—'}`;
  const l2 = `Total heures vocales : ${vocalStr}`;
  const l3 = usePanel
    ? `Total messages : ${messageCount.toLocaleString('fr-FR')}`
    : `Top activité : ${data.rankPos ?? '—'}`;
  const l4 = usePanel ? `Top activité : ${data.rankPos ?? '—'}` : null;
  const lineY0 = panelY + panelH * 0.22;
  const gap = panelH * 0.18;
  ctx.fillText(l1, tx, lineY0);
  ctx.fillText(l2, tx, lineY0 + gap);
  ctx.fillText(l3, tx, lineY0 + gap * 2);
  if (l4) ctx.fillText(l4, tx, lineY0 + gap * 3);

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'sayuri-rank.png' });
}

module.exports = {
  generateSayuriCard,
  mockRankData,
  RANKS,
  formatVocalHours,
  ASSETS,
  RANKS_DIR,
};

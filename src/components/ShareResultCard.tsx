"use client";

import React, { useState } from "react";
import { Card, Button } from "./ui";

const W = 1080;
const H = 1350;

const COLORS = {
  ink: "#10143a",
  card: "#faf8f2",
  teal: "#f6a017",
  mustardBright: "#f3e354",
  wine: "#c23653",
  muted: "#6b6660",
  success: "#25d366",
};

const SKILL_META: Record<string, { label: string; icon: string }> = {
  reading: { label: "Leitura", icon: "📖" },
  grammar: { label: "Gramática", icon: "🧩" },
  listening: { label: "Escuta", icon: "🎧" },
  speaking: { label: "Fala", icon: "🎙️" },
  writing: { label: "Escrita", icon: "✍️" },
};

type Motif = "skyline" | "notes" | "books" | "plane" | "mountain" | "leaf" | "wave" | "cup" | "spark";

type Theme = {
  bgFrom: string;
  bgTo: string;
  accent: string;
  tagline: string[];
  headline: string;
  bottomLines: string[];
  motif: Motif;
};

// Um tema visual por assunto de aula, inspirado nos materiais da marca.
// Cada um tem sua própria paleta, ilustração de fundo e frases.
const THEMES: Record<string, Theme> = {
  news: {
    bgFrom: "#2b2140",
    bgTo: "#120f24",
    accent: "#f6a017",
    tagline: ["IDEAS", "PEOPLE", "CULTURES", "YOU"],
    headline: "Curiosidade move o mundo.",
    bottomLines: ["Mais cultura. Mais oportunidades. Mais você.", "Aprender te conecta a novas realidades."],
    motif: "skyline",
  },
  music: {
    bgFrom: "#3a2350",
    bgTo: "#1c1030",
    accent: "#f3e354",
    tagline: ["SOUND", "RHYTHM", "WORDS", "YOU"],
    headline: "Cada palavra nova também é uma canção.",
    bottomLines: ["Sua voz também é uma canção em construção.", "Praticar também tem o seu próprio ritmo."],
    motif: "notes",
  },
  biography: {
    bgFrom: "#1f3326",
    bgTo: "#0f1d15",
    accent: "#f6a017",
    tagline: ["GOOD PROGRESS", "BRIGHTER", "YOU"],
    headline: "Consistência cria grandes histórias.",
    bottomLines: ["Pequenos passos, grandes conquistas.", "Sua história também está sendo escrita."],
    motif: "books",
  },
  travel: {
    bgFrom: "#123a52",
    bgTo: "#0a1f30",
    accent: "#f6a017",
    tagline: ["DIFFERENT PLACES", "SAME", "YOU"],
    headline: "Novos horizontes começam com uma nova palavra.",
    bottomLines: ["Idiomas abrem portas, você escolhe o destino.", "Você chega mais longe quando aprende."],
    motif: "plane",
  },
  work: {
    bgFrom: "#4a3418",
    bgTo: "#241a0c",
    accent: "#f6a017",
    tagline: ["LEARN", "EXPLORE", "EVOLVE"],
    headline: "Mais conhecimento, mais liberdade.",
    bottomLines: ["Disciplina hoje, resultados amanhã.", "Cada aula te aproxima dos seus planos."],
    motif: "mountain",
  },
  health: {
    bgFrom: "#2e3f2c",
    bgTo: "#162115",
    accent: "#f3e354",
    tagline: ["FOCUS", "PRACTICE", "PROGRESS", "FREEDOM"],
    headline: "Mente tranquila também aprende melhor.",
    bottomLines: ["Equilíbrio hoje, mais conquistas amanhã.", "Respirar bem também ajuda a aprender."],
    motif: "leaf",
  },
  sports: {
    bgFrom: "#123a44",
    bgTo: "#0a1f26",
    accent: "#25d366",
    tagline: ["MOVE", "TRAIN", "GROW", "YOU"],
    headline: "Disciplina no treino, disciplina no inglês.",
    bottomLines: ["Cada aula também é um treino de mente.", "Constância é o que constrói resultado."],
    motif: "wave",
  },
  cooking: {
    bgFrom: "#3d2418",
    bgTo: "#1e120c",
    accent: "#f6a017",
    tagline: ["SAME LEARNER", "BIGGER", "POSSIBILITIES"],
    headline: "Aprender também alimenta a sua mente.",
    bottomLines: ["Aprender é cuidar do seu amanhã.", "Boas receitas levam tempo, aprender também."],
    motif: "cup",
  },
};

const DEFAULT_THEME: Theme = {
  bgFrom: "#283758",
  bgTo: "#1c2843",
  accent: "#f6a017",
  tagline: ["FOCUS", "PRACTICE", "PROGRESS"],
  headline: "Cada aula te deixa mais perto do seu objetivo.",
  bottomLines: ["Mais um degrau vencido na jornada!", "Foi com prática que você chegou aqui hoje."],
  motif: "spark",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function ensureFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load("800 60px Poppins"),
      document.fonts.load("700 40px Poppins"),
      document.fonts.load("600 28px Poppins"),
      document.fonts.load("700 56px Caveat"),
      document.fonts.load("400 30px Poppins"),
    ]);
  } catch {
    // segue mesmo se alguma fonte não carregar — cai no fallback do canvas
  }
}

function drawTornLabel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const jag = 7;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((-1 * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.beginPath();
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const px = (w / steps) * i;
    const py = i % 2 === 0 ? 0 : (i * 37) % jag;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = 0; i <= steps; i++) {
    const py = h - (i % 2 === 0 ? 0 : (i * 53) % jag);
    const px = w - (w / steps) * i;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = COLORS.card;
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.restore();
}

function drawSpark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(9, 3);
  ctx.lineTo(11, 10);
  ctx.lineTo(7, 9);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 6);
  ctx.lineTo(20, 12);
  ctx.lineTo(13, 11.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, 13);
  ctx.lineTo(17, 19);
  ctx.lineTo(11, 17.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Ilustração de fundo simples e leve (baixa opacidade) que dá o clima de
// cada tema, sem depender de fotos externas — assim o card funciona 100%
// offline e sempre com a mesma identidade visual da marca.
function drawMotif(ctx: CanvasRenderingContext2D, motif: Motif, accent: string) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 3;

  if (motif === "skyline") {
    const baseY = H - 40;
    const widths = [70, 50, 90, 60, 110, 55, 80, 65, 95];
    let x = -20;
    widths.forEach((wBar, i) => {
      const hBar = 90 + ((i * 53) % 220);
      ctx.fillRect(x, baseY - hBar, wBar, hBar);
      x += wBar + 14;
    });
  } else if (motif === "notes") {
    const spots = [
      [140, 230],
      [900, 300],
      [160, 1000],
      [920, 1080],
    ];
    spots.forEach(([nx, ny]) => {
      ctx.beginPath();
      ctx.ellipse(nx, ny, 16, 12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(nx + 14, ny - 4);
      ctx.lineTo(nx + 14, ny - 70);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(nx + 14, ny - 70);
      ctx.quadraticCurveTo(nx + 42, ny - 60, nx + 30, ny - 30);
      ctx.stroke();
    });
  } else if (motif === "books") {
    const bx = 90;
    const by = H - 90;
    const heights = [26, 26, 26];
    const widths2 = [260, 230, 200];
    let cy = by;
    widths2.forEach((wBook, i) => {
      ctx.fillRect(bx, cy - heights[i], wBook, heights[i] - 4);
      cy -= heights[i];
    });
    ctx.beginPath();
    ctx.ellipse(W - 160, H - 140, 70, 100, 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (motif === "plane") {
    ctx.save();
    ctx.translate(W - 220, 480);
    ctx.rotate(-0.55);
    ctx.beginPath();
    ctx.moveTo(-90, 0);
    ctx.lineTo(90, 0);
    ctx.lineTo(60, -14);
    ctx.lineTo(-60, -14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-60, 60);
    ctx.lineTo(-30, 60);
    ctx.lineTo(20, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    [[160, 900, 60], [880, 980, 44], [220, 1080, 50]].forEach(([cx, cy, r]) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (motif === "mountain") {
    const baseY = H - 40;
    ctx.beginPath();
    ctx.moveTo(-40, baseY);
    ctx.lineTo(240, baseY - 300);
    ctx.lineTo(460, baseY - 90);
    ctx.lineTo(650, baseY - 320);
    ctx.lineTo(940, baseY - 120);
    ctx.lineTo(1120, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(650, baseY - 320);
    ctx.lineTo(650, baseY - 380);
    ctx.lineTo(690, baseY - 364);
    ctx.lineTo(650, baseY - 348);
    ctx.closePath();
    ctx.fill();
  } else if (motif === "leaf") {
    const leaves: [number, number, number][] = [
      [130, H - 160, 0.3],
      [210, H - 260, -0.4],
      [960, H - 200, 0.6],
    ];
    leaves.forEach(([lx, ly, rot]) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, 90, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    [[900, H - 90, 46], [900, H - 150, 34], [900, H - 195, 24]].forEach(([cx, cy, r]) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (motif === "wave") {
    for (let row = 0; row < 3; row++) {
      const baseY = H - 200 + row * 60;
      ctx.beginPath();
      ctx.moveTo(-40, baseY);
      for (let x = -40; x <= W + 40; x += 40) {
        ctx.quadraticCurveTo(x + 20, baseY + (row % 2 === 0 ? -18 : 18), x + 40, baseY);
      }
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  } else if (motif === "cup") {
    ctx.save();
    ctx.translate(W / 2, H - 210);
    ctx.beginPath();
    ctx.moveTo(-70, -40);
    ctx.lineTo(70, -40);
    ctx.lineTo(55, 60);
    ctx.quadraticCurveTo(0, 90, -55, 60);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(80, -10, 22, 30, 0, -1.4, 1.4);
    ctx.stroke();
    [-28, 0, 28].forEach((ox) => {
      ctx.beginPath();
      ctx.moveTo(ox, -55);
      ctx.quadraticCurveTo(ox - 16, -90, ox, -120);
      ctx.lineWidth = 4;
      ctx.stroke();
    });
    ctx.restore();
  } else {
    drawSpark(ctx, 160, 1120, 60, "#ffffff");
    drawSpark(ctx, 920, 220, 46, "#ffffff");
  }

  ctx.restore();
}

function scoreColor(score: string) {
  if (score === "forte") return COLORS.teal;
  if (score === "a desenvolver") return COLORS.wine;
  return "#c9891b";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  align: "center" | "left" = "center"
) {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = align;
  const words = (text || "").split(" ");
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);
  const clipped = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = clipped[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    clipped[maxLines - 1] = last + "…";
  }
  clipped.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  ctx.textAlign = prevAlign;
}

export async function buildShareImageDataUrl(params: {
  topicTitle: string;
  topicKind?: string;
  level: string;
  overall: number | null;
  bySkill: Record<string, { score: string; note: string } | undefined>;
}): Promise<string> {
  await ensureFonts();

  const theme = (params.topicKind && THEMES[params.topicKind]) || DEFAULT_THEME;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // fundo: gradiente temático + ilustração leve de apoio
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.bgFrom);
  grad.addColorStop(1, theme.bgTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  drawMotif(ctx, theme.motif, theme.accent);

  // véu suave na parte de baixo: evita que o motivo de fundo "atravesse"
  // visualmente os cards de habilidade e a frase final, mantendo o clima
  // do tema sem disputar atenção com o conteúdo em primeiro plano.
  const scrim = ctx.createLinearGradient(0, 700, 0, H);
  scrim.addColorStop(0, "rgba(0,0,0,0)");
  scrim.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 700, W, H - 700);

  // logo, canto superior esquerdo
  try {
    const logo = await loadImage("/unblocking-minds-logo-light.png");
    const logoW = 250;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, 46, 46, logoW, logoH);
  } catch {
    // se o logo não carregar, segue sem ele
  }

  // tagline em inglês, canto superior direito
  ctx.textAlign = "right";
  ctx.font = "700 15px Poppins, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  theme.tagline.slice(0, 4).forEach((word, i) => {
    ctx.fillText(word.toUpperCase(), W - 46, 62 + i * 21);
  });

  // manchete script do tema (altura reservada para até 2 linhas)
  ctx.fillStyle = COLORS.mustardBright;
  ctx.font = "700 50px 'Caveat', cursive";
  ctx.textAlign = "center";
  wrapText(ctx, theme.headline, W / 2, 190, 900, 54, 2);

  // "Aula concluída hoje!"
  ctx.fillStyle = COLORS.card;
  ctx.font = "800 28px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Aula concluída hoje!", W / 2, 330);

  // torn label com o tema da aula
  const labelY = 366;
  const labelH = 170;
  const labelW = 920;
  const labelX = (W - labelW) / 2;
  drawTornLabel(ctx, labelX, labelY, labelW, labelH);
  ctx.fillStyle = COLORS.ink;
  ctx.font = "800 42px Poppins, sans-serif";
  ctx.textAlign = "center";
  wrapText(ctx, params.topicTitle, W / 2, labelY + 50, labelW - 80, 46, 2);
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`Nível ${params.level}`, W / 2, labelY + 140);

  // nota geral
  const badgeCy = 632;
  const badgeR = 76;
  if (typeof params.overall === "number") {
    ctx.beginPath();
    ctx.arc(W / 2, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W / 2, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 66px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(params.overall.toFixed(1), W / 2, badgeCy + 20);
    ctx.font = "600 19px Poppins, sans-serif";
    ctx.fillStyle = COLORS.mustardBright;
    ctx.fillText("nota geral", W / 2, badgeCy + 52);
  }

  // grade de habilidades: 5 cards em duas colunas (a última fica centralizada sozinha)
  const gridTop = badgeCy + badgeR + 46;
  const gap = 14;
  const gridW = 920;
  const cardW = (gridW - gap) / 2;
  const cardH = 110;
  const gridLeft = (W - gridW) / 2;
  const keys = Object.keys(SKILL_META);
  const rows = Math.ceil(keys.length / 2);
  keys.forEach((key, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const isLastAlone = i === keys.length - 1 && keys.length % 2 === 1;
    const x = isLastAlone ? W / 2 - cardW / 2 : gridLeft + col * (cardW + gap);
    const y = gridTop + row * (cardH + gap);
    const meta = SKILL_META[key];
    const s = params.bySkill?.[key];

    roundRect(ctx, x, y, cardW, cardH, 10);
    ctx.fillStyle = COLORS.card;
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.ink;
    ctx.font = "600 23px Poppins, sans-serif";
    ctx.fillText(`${meta.icon}  ${meta.label}`, x + 18, y + 32);

    if (s) {
      ctx.fillStyle = scoreColor(s.score);
      ctx.font = "700 18px Poppins, sans-serif";
      ctx.fillText(s.score.toUpperCase(), x + 18, y + 58);
      ctx.fillStyle = "#4a4636";
      ctx.font = "400 15.5px Poppins, sans-serif";
      wrapText(ctx, s.note, x + 18, y + 80, cardW - 36, 18, 2, "left");
    } else {
      ctx.fillStyle = COLORS.muted;
      ctx.font = "400 16px Poppins, sans-serif";
      ctx.fillText("Sem dados", x + 18, y + 58);
    }
  });

  // frase final do tema
  const gridBottom = gridTop + cardH * rows + gap * (rows - 1);
  const bottomLine = theme.bottomLines[Math.floor(Math.random() * theme.bottomLines.length)];
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.mustardBright;
  ctx.font = "700 40px 'Caveat', cursive";
  wrapText(ctx, bottomLine, W / 2, gridBottom + 60, 940, 44, 2);

  // rodapé
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillText("+Unblocking", W / 2, H - 50);

  return canvas.toDataURL("image/png");
}

export function ShareResultButton({
  topicTitle,
  topicKind,
  level,
  overall,
  bySkill,
}: {
  topicTitle: string;
  topicKind?: string;
  level: string;
  overall: number | null;
  bySkill: Record<string, { score: string; note: string } | undefined>;
}) {
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const url = await buildShareImageDataUrl({ topicTitle, topicKind, level, overall, bySkill });
      setImageUrl(url);

      // Converte o dataURL em File para poder usar a Web Share API do
      // navegador — no Safari/iOS é a única forma de "baixar": o
      // atributo download de <a> não funciona lá, mas o menu nativo de
      // compartilhar permite salvar em Fotos ou enviar direto pro Instagram.
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `unblocking-${Date.now()}.png`, { type: "image/png" });
      setImageFile(file);
      setCanNativeShare(
        typeof navigator !== "undefined" &&
          !!navigator.share &&
          !!navigator.canShare &&
          navigator.canShare({ files: [file] })
      );
    } catch (e: any) {
      setError("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    if (!imageFile) return;
    try {
      await navigator.share({
        files: [imageFile],
        title: "+Unblocking",
        text: "Mais uma aula de inglês concluída no +Unblocking! 🎉",
      });
    } catch {
      // usuário cancelou o compartilhamento — nada a fazer
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <Button
        variant="ghost"
        onClick={handleGenerate}
        disabled={generating}
        style={{ width: "100%", padding: "12px 0" }}
      >
        {generating ? "Gerando imagem…" : "📤 Compartilhar resultado"}
      </Button>

      {error && <div style={{ color: "var(--wine)", fontSize: 12.5, marginTop: 8 }}>{error}</div>}

      {imageUrl && (
        <Card style={{ marginTop: 12, textAlign: "center" }}>
          <SectionLabelInline>Pronto para compartilhar no Instagram</SectionLabelInline>
          <img
            src={imageUrl}
            alt="Resultado da aula para compartilhar"
            style={{ width: "100%", maxWidth: 340, borderRadius: 8, margin: "10px auto", display: "block" }}
          />
          {canNativeShare ? (
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Button onClick={handleShare} style={{ flex: 1 }}>
                📤 Salvar / Compartilhar
              </Button>
              <Button variant="subtle" onClick={handleGenerate} style={{ flex: 1 }}>
                🔁 Gerar outra
              </Button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <a
                  href={imageUrl}
                  download={`unblocking-${Date.now()}.png`}
                  style={{
                    flex: 1,
                    display: "block",
                    textAlign: "center",
                    padding: "11px 0",
                    borderRadius: 3,
                    background: "var(--teal)",
                    color: "var(--ink)",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  ⬇️ Baixar imagem
                </a>
                <Button variant="subtle" onClick={handleGenerate} style={{ flex: 1 }}>
                  🔁 Gerar outra
                </Button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
                No iPhone: se o botão não baixar, toque e segure a imagem acima e escolha "Salvar imagem".
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function SectionLabelInline({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>{children}</div>;
}

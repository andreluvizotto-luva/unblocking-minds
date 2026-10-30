"use client";

import { useEffect, useState } from "react";
import { temaDoDia, type TemaSazonal as Tema } from "@/lib/tema-sazonal";

// Começa em null (igual ao HTML do servidor) e só decide depois de montar,
// para não dar divergência de hidratação.
export function useTemaSazonal(): Tema {
  const [tema, setTema] = useState<Tema>(null);
  useEffect(() => {
    const forcado = new URLSearchParams(window.location.search).get("tema");
    setTema(temaDoDia(new Date(), forcado));
  }, []);
  return tema;
}

// Teia de aranha: raios e arcos partindo do canto superior esquerdo.
function caminhoDaTeia(): string {
  const angulos = [0, 22.5, 45, 67.5, 90].map((a) => (a * Math.PI) / 180);
  const f = (n: number) => n.toFixed(1);
  let d = "";
  for (const a of angulos) d += `M0 0L${f(Math.cos(a) * 124)} ${f(Math.sin(a) * 124)}`;
  for (const r of [34, 68, 104]) {
    const p = angulos.map((a) => [Math.cos(a) * r, Math.sin(a) * r]);
    d += `M${f(p[0][0])} ${f(p[0][1])}`;
    for (let i = 1; i < p.length; i++) {
      const mx = ((p[i - 1][0] + p[i][0]) / 2) * 0.86;
      const my = ((p[i - 1][1] + p[i][1]) / 2) * 0.86;
      d += `Q${f(mx)} ${f(my)} ${f(p[i][0])} ${f(p[i][1])}`;
    }
  }
  return d;
}
const TEIA = caminhoDaTeia();

const MORCEGO =
  "M32 6C30 6 29 8 28 9 25 8 20 3 10 2 13 6 14 10 13 14 9 13 5 14 1 17 6 17 9 19 11 23 14 20 18 20 21 23 24 21 26 22 28 26L32 20 36 26C38 22 40 21 43 23 46 20 50 20 53 23 55 19 58 17 63 17 59 14 55 13 51 14 50 10 51 6 54 2 44 3 39 8 36 9 35 8 34 6 32 6Z";

export function Abobora({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.875)} viewBox="0 0 64 56" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M30 9Q32 1 40 1Q39 6 35 9Z" fill="#5f8f2f" />
      <ellipse cx="19" cy="33" rx="16" ry="20" fill="#ff7a1a" stroke="#d85d00" strokeWidth="1.5" />
      <ellipse cx="45" cy="33" rx="16" ry="20" fill="#ff7a1a" stroke="#d85d00" strokeWidth="1.5" />
      <ellipse cx="32" cy="33" rx="14" ry="22" fill="#ff8f2e" stroke="#d85d00" strokeWidth="1.5" />
      <path d="M20 29L25 21 30 29Z M34 29L39 21 44 29Z" fill="#2a1640" />
      <path d="M19 38L25 46 29 42 32 47 35 42 39 46 45 38Q32 51 19 38Z" fill="#2a1640" />
    </svg>
  );
}

// Enfeite só na faixa do topo, por cima do conteúdo e sem capturar toque.
// Fica restrito ao cabeçalho para não distrair durante a aula.
function DecoracaoHalloween() {
  return (
    <div className="hw-deco" aria-hidden="true">
      <div className="hw-glow" />
      <svg className="hw-web" viewBox="0 0 130 130">
        <path d={TEIA} fill="none" stroke="rgba(246,239,230,.4)" strokeWidth="1" />
      </svg>
      {[0, 1, 2].map((i) => (
        <svg key={i} className={`hw-bat hw-bat-${i}`} viewBox="0 0 64 28">
          <path d={MORCEGO} />
        </svg>
      ))}
    </div>
  );
}

// Montado uma vez no layout: marca o <html> com data-tema (os tokens de cor
// mudam em globals.css) e desenha o enfeite.
export default function TemaSazonal() {
  const tema = useTemaSazonal();
  useEffect(() => {
    const el = document.documentElement;
    if (tema) el.dataset.tema = tema;
    else delete el.dataset.tema;
    return () => {
      delete el.dataset.tema;
    };
  }, [tema]);
  return tema === "halloween" ? <DecoracaoHalloween /> : null;
}

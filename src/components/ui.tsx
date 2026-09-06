"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export function Card({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--card)",
        color: "var(--ink)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "22px 24px",
        boxShadow: "0 2px 14px rgba(16, 20, 58, 0.10)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Barra de progresso simples (usada nas conquistas: "faltam X para Y") —
// preenchimento animado suavemente quando o valor muda.
export function ProgressBar({
  value,
  max,
  color = "var(--teal)",
  trackColor = "rgba(16, 20, 58, 0.08)",
  height = 8,
  style,
}: {
  value: number;
  max: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: React.CSSProperties;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ width: "100%", height, borderRadius: height, background: trackColor, overflow: "hidden", ...style }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: height,
          background: color,
          transition: "width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      />
    </div>
  );
}

// Pequeno raio/fagulha decorativo — o mesmo elemento que aparece solto nos
// materiais da marca (ao lado de palavras de destaque). Puramente ornamental.
// A logomarca oficial (public/spark.png) já é laranja e tem fundo
// transparente, então é usada como imagem em vez de recriada em SVG — evita
// qualquer divergência com o grafismo real da marca.
export function Spark({ size = 16, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/spark.png"
      alt=""
      width={size}
      height={size}
      style={{ display: "inline-block", flexShrink: 0, objectFit: "contain", ...style }}
      aria-hidden="true"
    />
  );
}

// Mensagens padrão exibidas em rotação enquanto algum processo de IA está
// rodando (gerar aula, gerar relatório, avaliar fala/escrita). Escritas na
// "vibe" da marca — o verbo "destravar" é o coração do nome +Unblocking.
const DEFAULT_PROCESSING_MESSAGES = [
  "Destravando novas ideias para você…",
  "Conectando as palavras certas…",
  "Ajustando o nível certinho pro seu momento…",
  "Preparando o seu próximo desbloqueio…",
  "Quase lá — só mais um instante…",
];

// Animação de espera com a fagulha da marca pulsando e uma frase que troca
// a cada poucos segundos — usada em qualquer processo assíncrono (gerar
// aula, gerar relatório, avaliar fala/escrita) em vez de um texto estático.
export function ProcessingAnimation({
  title,
  messages = DEFAULT_PROCESSING_MESSAGES,
  size = "default",
}: {
  title?: string;
  messages?: string[];
  size?: "default" | "compact";
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % messages.length);
    }, 2400);
    return () => clearInterval(id);
  }, [messages]);

  const sparkSize = size === "compact" ? 30 : 52;

  return (
    <div style={{ textAlign: "center", padding: size === "compact" ? "6px 4px" : "10px 4px" }}>
      <Spark size={sparkSize} style={{ animation: "sparkPulse 1.7s ease-in-out infinite", marginBottom: size === "compact" ? 6 : 14 }} />
      {title && (
        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: size === "compact" ? 14 : 17,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
      )}
      <div
        key={idx}
        className="fade-in-up"
        style={{ fontSize: size === "compact" ? 12.5 : 13.5, color: "var(--muted)", minHeight: 18 }}
      >
        {messages[idx]}
      </div>
    </div>
  );
}

// Rótulo em "papel rasgado" — o mesmo grafismo usado nos títulos dos
// materiais da marca (uma tarja branca com bordas irregulares).
export function TornLabel({
  children,
  style,
  textStyle,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "inline-block",
        background: "#faf8f2",
        color: "var(--ink)",
        padding: "6px 18px",
        transform: "rotate(-1deg)",
        clipPath:
          "polygon(0% 8%, 3% 0%, 12% 4%, 24% 0%, 37% 5%, 49% 1%, 61% 4%, 74% 0%, 86% 3%, 100% 6%, 98% 92%, 100% 100%, 88% 96%, 76% 100%, 63% 95%, 50% 100%, 38% 96%, 25% 100%, 13% 97%, 1% 100%, 3% 90%)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        ...style,
      }}
    >
      <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, ...textStyle }}>{children}</span>
    </div>
  );
}

// Seta desenhada à mão — grafismo recorrente nos materiais da marca,
// apontando para elementos de destaque (CTAs, nomes de curso etc).
export function HandArrow({
  size = 60,
  color = "var(--teal)",
  rotate = 0,
  style,
}: {
  size?: number;
  color?: string;
  rotate?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      style={{ display: "inline-block", transform: `rotate(${rotate}deg)`, ...style }}
      aria-hidden="true"
    >
      <path
        d="M8 62 C 22 60, 30 40, 52 20"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M40 14 L54 18 L50 32" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "subtle" | "danger";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const base: React.CSSProperties = {
    fontSize: 14.5,
    fontWeight: 600,
    padding: "10px 20px",
    borderRadius: 999,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    opacity: disabled ? 0.5 : 1,
    transition: "transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease",
    transform: pressed ? "scale(0.97)" : hovered ? "translateY(-1px)" : "none",
    boxShadow: !disabled && variant === "primary" ? (hovered ? "0 4px 14px rgba(246, 160, 23, 0.4)" : "0 2px 8px rgba(246, 160, 23, 0.25)") : "none",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--teal)", color: "var(--ink)", border: "1px solid var(--teal)" },
    ghost: { background: "transparent", color: "var(--teal)", border: "1px solid var(--teal)" },
    subtle: { background: "#f5efe0", color: "var(--ink)", border: "1px solid var(--line)" },
    danger: { background: "var(--wine)", color: "#ffffff", border: "1px solid var(--wine)" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>{children}</div>;
}

// Interruptor liga/desliga (usado no painel de admin para habilitar/
// desabilitar o acesso de um aluno).
export function Switch({
  checked,
  onChange,
  disabled,
  labelOn = "Ativo",
  labelOff = "Desativado",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "none",
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? "var(--success)" : "#c9c4ba",
          position: "relative",
          transition: "background 0.15s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transition: "left 0.15s ease",
          }}
        />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: checked ? "var(--success)" : "var(--muted)" }}>
        {checked ? labelOn : labelOff}
      </span>
    </button>
  );
}

// Hook de narração baseado em áudio gerado no servidor (OpenAI TTS) —
// funciona de forma idêntica em PC, iOS e Android, ao contrário da antiga
// narração via speechSynthesis do navegador (qualidade/voz inconsistente
// entre plataformas). O áudio é buscado assim que o bloco de listening
// monta (attachFromText), para que o play() aconteça de forma síncrona
// dentro do clique do usuário — necessário para o autoplay funcionar de
// forma confiável no Safari/iOS.
export function useCloudSpeech() {
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const attachFromText = useCallback((text: string, voiceSeed?: string, voice?: string) => {
    let cancelled = false;
    setReady(false);
    setLoadError(false);
    setSpeaking(false);
    setPaused(false);

    (async () => {
      try {
        const res = await fetch("/api/tts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceSeed, voice }),
        });
        if (!res.ok) throw new Error("tts failed");
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          setSpeaking(false);
          setPaused(false);
        };
        audio.onerror = () => {
          setSpeaking(false);
          setPaused(false);
        };
        audioElRef.current = audio;
        setReady(true);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (audioElRef.current) {
        audioElRef.current.pause();
        if (audioElRef.current.src) URL.revokeObjectURL(audioElRef.current.src);
        audioElRef.current = null;
      }
    };
  }, []);

  // Chamado direto de dentro do onClick — precisa ser síncrono (sem await
  // antes) para o Safari/iOS permitir o autoplay do áudio.
  const play = useCallback(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    setSpeaking(true);
    setPaused(false);
    audio.currentTime = 0;
    audio.play().catch(() => setSpeaking(false));
  }, []);

  const pause = useCallback(() => {
    audioElRef.current?.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    audioElRef.current?.play().catch(() => {});
    setPaused(false);
  }, []);

  const stop = useCallback(() => {
    const audio = audioElRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setSpeaking(false);
    setPaused(false);
  }, []);

  return { attachFromText, play, pause, resume, stop, speaking, paused, ready, loadError };
}

// Formatos de áudio tentados, em ordem de preferência — "audio/mp4" é o que
// o Safari/iOS grava nativamente; os demais cobrem Chrome/Firefox/Android.
const RECORDER_MIME_CANDIDATES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return RECORDER_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function extensionForMime(mime: string) {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

// Hook de gravação de áudio (microfone) + envio para transcrição no
// servidor (OpenAI Whisper) — substitui a antiga SpeechRecognition do
// navegador, que não existe em nenhum navegador no iOS. Funciona em
// qualquer navegador com getUserMedia/MediaRecorder (PC, iOS 14.3+,
// Android); requer HTTPS ou localhost (exigência do próprio navegador
// para acesso ao microfone).
export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>("");

  useEffect(() => {
    const hasApi =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    setSupported(hasApi);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      mimeTypeRef.current = mimeType || "audio/webm";
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      return true;
    } catch {
      setSupported(false);
      return false;
    }
  }, []);

  const stop = useCallback((): Promise<{ blob: Blob; filename: string } | null> => {
    return new Promise((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const mimeType = mimeTypeRef.current || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        resolve({ blob, filename: `speech.${extensionForMime(mimeType)}` });
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  return { start, stop, recording, supported };
}

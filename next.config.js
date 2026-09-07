/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança aplicados a todas as rotas.
//
// Motivação: o cookie de sessão do Supabase (aquele "sb-...-auth-token" em
// base64) contém o JWT do aluno. O base64 não é proteção nenhuma — mas ele
// também não precisa ser, porque o JWT é assinado e não dá para forjar. O
// risco real é alguém conseguir INJETAR script na página (XSS) e ler esse
// cookie. Estes cabeçalhos reduzem esse vetor e algumas outras classes de
// ataque comuns.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' é necessário porque o Next injeta scripts inline de
  // hidratação; 'unsafe-eval' só no modo de desenvolvimento (fast refresh).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // O app usa estilos inline do React (style={{...}}) e o Google Fonts.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // Áudio do listening (TTS) e a gravação da fala do aluno chegam como blob.
  "media-src 'self' blob: data:",
  // Só o próprio app e o Supabase — impede exfiltração de dados para
  // domínios de terceiros caso algum script malicioso entre na página.
  "connect-src 'self' https://*.supabase.co",
  // Ninguém pode embutir o app dentro de um iframe (anti-clickjacking).
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Redundante com frame-ancestors, mas cobre navegadores antigos.
          { key: "X-Frame-Options", value: "DENY" },
          // Impede o navegador de "adivinhar" o tipo de um arquivo servido.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Não vaza a URL completa do app para sites externos.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // O app usa microfone (fala); câmera e geolocalização, nunca.
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          // Força HTTPS por 2 anos — a Vercel já serve só em HTTPS, isto
          // impede um downgrade forçado na primeira visita.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

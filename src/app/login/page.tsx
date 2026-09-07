"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Spark } from "@/components/ui";

// Espelha a política de senha configurada no painel do Supabase. A validação
// que vale é sempre a do servidor (esta aqui é burlável pelo console) — o
// objetivo deste bloco é só dar ao aluno um retorno claro em português, em
// vez do erro genérico em inglês que o Supabase devolve.
const PASSWORD_RULES: { test: (v: string) => boolean; label: string }[] = [
  { test: (v) => v.length >= 10, label: "pelo menos 10 caracteres" },
  { test: (v) => /[a-z]/.test(v), label: "uma letra minúscula" },
  { test: (v) => /[A-Z]/.test(v), label: "uma letra maiúscula" },
  { test: (v) => /[0-9]/.test(v), label: "um número" },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: "um símbolo (ex: ! @ # $)" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (mode === "signup") {
      const faltando = PASSWORD_RULES.filter((r) => !r.test(password));
      if (faltando.length > 0) {
        setError(`Sua senha precisa ter ${faltando.map((r) => r.label).join(", ")}.`);
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form
        onSubmit={submit}
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 4,
          padding: "28px 26px",
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <img src="/unblocking-minds-logo.png" alt="Unblocking Minds" style={{ height: 46, width: "auto" }} />
        </div>
        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 24,
            fontWeight: 800,
            marginBottom: 4,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          +Unblocking
          <Spark size={14} style={{ marginTop: -12 }} />
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: "var(--mustard)", marginBottom: 20, textAlign: "center" }}>
          {mode === "login" ? "Entre para continuar sua prática" : "Crie sua conta para começar"}
        </div>

        {mode === "signup" && (
          <input
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />

        {mode === "signup" && password.length > 0 && (
          <div style={{ fontSize: 12, marginBottom: 10, marginTop: -4, lineHeight: 1.7 }}>
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <div key={rule.label} style={{ color: ok ? "var(--sage)" : "var(--muted)" }}>
                  {ok ? "✓" : "○"} {rule.label}
                </div>
              );
            })}
          </div>
        )}

        {error && <div style={{ color: "var(--wine)", fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "11px 0",
            background: "var(--teal)",
            color: "var(--ink)",
            border: "none",
            borderRadius: 3,
            fontWeight: 600,
            fontSize: 14.5,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>

        <div style={{ textAlign: "center", fontSize: 13, marginTop: 14 }}>
          {mode === "login" ? (
            <span>
              Não tem conta?{" "}
              <a onClick={() => setMode("signup")} style={{ color: "var(--teal)", cursor: "pointer" }}>
                Cadastre-se
              </a>
            </span>
          ) : (
            <span>
              Já tem conta?{" "}
              <a onClick={() => setMode("login")} style={{ color: "var(--teal)", cursor: "pointer" }}>
                Entrar
              </a>
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            fontSize: 12,
          }}
        >
          <a
            href="https://www.instagram.com/missgasparandrea/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--muted)" }}
          >
            Instagram
          </a>
          <a
            href="https://wa.me/c/5515974065619"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--muted)" }}
          >
            WhatsApp
          </a>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          por Unblocking Minds, Mindful Learning e Bilingual Education
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 3,
  padding: "9px 12px",
  fontSize: 14.5,
  background: "#fbf8f1",
  marginBottom: 10,
};

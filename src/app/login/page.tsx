"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Spark } from "@/components/ui";
import { PASSWORD_RULES, mensagemDePendencias } from "@/lib/password-rules";


export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [recoverySent, setRecoverySent] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "recover") {
      // redirectTo precisa estar na lista de Redirect URLs do Supabase.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Mesmo quando o e-mail não existe, confirmamos do mesmo jeito: dizer
      // "esta conta não existe" entregaria a quem está de fora quais e-mails
      // têm cadastro aqui.
      if (error) setError(error.message);
      else setRecoverySent(true);
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const pendencias = mensagemDePendencias(password);
      if (pendencias) {
        setError(pendencias);
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) setError(error.message);
      else setSignupDone(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      {/* Aviso pós-cadastro. Antes o aluno era mandado de volta para o login
          sem explicação nenhuma, e ficava sem saber que precisava confirmar o
          e-mail — nem que, depois disso, ainda haveria uma liberação. */}
      {signupDone && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(16, 20, 58, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="fade-in-up"
            style={{
              background: "var(--card)",
              borderRadius: 8,
              padding: "30px 26px",
              width: "100%",
              maxWidth: 380,
              textAlign: "center",
            }}
          >
            <Spark size={38} style={{ marginBottom: 12 }} />

            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 19, fontWeight: 700, marginBottom: 10 }}>
              Falta só confirmar seu e-mail
            </div>

            <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink)", marginBottom: 16 }}>
              Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail e clique no link para ativar
              sua conta. Se não aparecer em alguns minutos, confira a caixa de spam.
            </div>

            <div
              style={{
                background: "#fbf8f1",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--muted)",
                textAlign: "left",
                marginBottom: 16,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "var(--ink)" }}>Abra no mesmo navegador</strong> em que você se cadastrou. Assim
                você já entra direto, sem precisar digitar a senha de novo.
              </div>
              <div>
                <strong style={{ color: "var(--ink)" }}>Depois de confirmar</strong>, sua conta ainda passa por uma
                liberação da administração do +Unblocking. Você recebe acesso assim que isso acontecer.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSignupDone(false);
                setMode("login");
                setPassword("");
                setName("");
              }}
              style={{
                width: "100%",
                padding: "11px 0",
                background: "var(--teal)",
                color: "var(--ink)",
                border: "none",
                borderRadius: 3,
                fontFamily: "inherit",
                fontWeight: 600,
                fontSize: 14.5,
                cursor: "pointer",
              }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}

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
          {mode === "login" && "Entre para continuar sua prática"}
          {mode === "signup" && "Crie sua conta para começar"}
          {mode === "recover" && "Vamos recuperar seu acesso"}
        </div>

        {mode === "recover" && recoverySent && (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, textAlign: "center" }}>
            Se houver uma conta com esse e-mail, o link para criar uma senha nova já está a caminho. Confira também a
            caixa de spam.
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>
              Importante: abra o link no mesmo navegador em que você fez este pedido.
            </div>
          </div>
        )}

        {mode === "signup" && (
          <input
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        )}
        {!recoverySent && (
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        )}
        {mode !== "recover" && (
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />
        )}

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

        {!recoverySent && (
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
          {loading ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "recover" ? "Enviar link de recuperação" : "Criar conta"}
        </button>
        )}

        <div style={{ textAlign: "center", fontSize: 13, marginTop: 14, lineHeight: 1.9 }}>
          {mode === "login" && (
            <>
              <div>
                Não tem conta?{" "}
                <a onClick={() => setMode("signup")} style={{ color: "var(--teal)", cursor: "pointer" }}>
                  Cadastre-se
                </a>
              </div>
              <div>
                <a
                  onClick={() => {
                    setMode("recover");
                    setError("");
                  }}
                  style={{ color: "var(--muted)", cursor: "pointer", fontSize: 12.5 }}
                >
                  Esqueci minha senha
                </a>
              </div>
            </>
          )}

          {mode === "signup" && (
            <span>
              Já tem conta?{" "}
              <a onClick={() => setMode("login")} style={{ color: "var(--teal)", cursor: "pointer" }}>
                Entrar
              </a>
            </span>
          )}

          {mode === "recover" && (
            <span>
              <a
                onClick={() => {
                  setMode("login");
                  setRecoverySent(false);
                  setError("");
                }}
                style={{ color: "var(--teal)", cursor: "pointer" }}
              >
                Voltar para o login
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Spark } from "@/components/ui";
import { PASSWORD_RULES, mensagemDePendencias } from "@/lib/password-rules";

// Tela onde o aluno cai ao clicar no link do e-mail de redefinição.
//
// Como funciona: o link do e-mail passa pelo Supabase, que redireciona para
// cá com um "code" na URL. Trocamos esse código por uma sessão temporária e,
// com ela, gravamos a nova senha. O código é de uso único e expira.
//
// Importante: o fluxo é PKCE, então a troca só funciona no MESMO navegador
// que pediu a redefinição — o verificador fica guardado ali. Quem pede no
// celular e abre o e-mail no computador cai no erro, e por isso a mensagem
// de falha explica exatamente isso em vez de dizer só "link inválido".
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [verificando, setVerificando] = useState(true);
  const [linkValido, setLinkValido] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);

      // O Supabase devolve o motivo na própria URL quando o link já expirou
      // ou foi usado antes.
      const erroNaUrl = params.get("error_description") || params.get("error");
      if (erroNaUrl) {
        setErro("Este link expirou ou já foi usado. Peça um novo na tela de login.");
        setVerificando(false);
        return;
      }

      const code = params.get("code");
      if (!code) {
        setErro("Link inválido. Abra o link direto do e-mail que você recebeu.");
        setVerificando(false);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setErro(
          "Não foi possível validar este link. Ele expira depois de um tempo e só funciona no mesmo navegador onde você pediu a redefinição. Peça um novo na tela de login."
        );
      } else {
        setLinkValido(true);
        // Tira o código da barra de endereço: ele é de uso único e não há
        // motivo para ficar exposto no histórico do navegador.
        window.history.replaceState({}, "", window.location.pathname);
      }
      setVerificando(false);
    })();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const pendencias = mensagemDePendencias(senha);
    if (pendencias) {
      setErro(pendencias);
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    setPronto(true);
    // Pequena pausa para o aluno ler a confirmação antes de seguir.
    setTimeout(() => router.push("/"), 1600);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form
        onSubmit={salvar}
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
        <div
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 17,
            color: "var(--mustard)",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Criando uma senha nova
        </div>

        {verificando && (
          <div style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center" }}>Validando seu link…</div>
        )}

        {!verificando && pronto && (
          <div style={{ fontSize: 13.5, textAlign: "center", lineHeight: 1.6 }}>
            Senha alterada. Já estamos te levando de volta para a prática.
          </div>
        )}

        {!verificando && !pronto && linkValido && (
          <>
            <input
              type="password"
              placeholder="Nova senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              style={inputStyle}
            />

            {senha.length > 0 && (
              <div style={{ fontSize: 12, marginBottom: 10, marginTop: -4, lineHeight: 1.7 }}>
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(senha);
                  return (
                    <div key={rule.label} style={{ color: ok ? "var(--sage)" : "var(--muted)" }}>
                      {ok ? "✓" : "○"} {rule.label}
                    </div>
                  );
                })}
              </div>
            )}

            <input
              type="password"
              placeholder="Repita a nova senha"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
              style={inputStyle}
            />

            {erro && <div style={{ color: "var(--wine)", fontSize: 13, marginBottom: 10 }}>{erro}</div>}

            <button
              type="submit"
              disabled={salvando}
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
                marginTop: 4,
              }}
            >
              {salvando ? "Salvando…" : "Salvar nova senha"}
            </button>
          </>
        )}

        {!verificando && !linkValido && !pronto && (
          <>
            <div style={{ color: "var(--wine)", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{erro}</div>
            <button
              type="button"
              onClick={() => router.push("/login")}
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
              Voltar para o login
            </button>
          </>
        )}
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

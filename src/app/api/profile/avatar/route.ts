import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveUser } from "@/lib/require-active-user";

// Foto de perfil por upload. O navegador reduz a imagem e envia sempre em
// JPEG (poucas dezenas de KB); aqui o servidor confere o tamanho e os
// primeiros bytes do arquivo, sem confiar no tipo que o cliente declarou.
//
// O arquivo vai para o bucket público "avatars", num caminho fixo por aluno
// (uma foto só, trocada no lugar). A escrita é feita com a chave de
// servidor, depois de checar quem está chamando — o bucket não tem policy de
// escrita para o navegador.
const MAX_BYTES = 512 * 1024;

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let file: FormDataEntryValue | null = null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "A imagem é grande demais. Tente outra foto." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!isJpeg) {
    return NextResponse.json({ error: "Formato de imagem não aceito." }, { status: 415 });
  }

  const path = `${check.userId}/avatar.jpg`;
  const admin = supabaseAdmin();
  const { error: upErr } = await admin.storage.from("avatars").upload(path, buffer, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (upErr) {
    console.error("[profile/avatar] falha no upload:", upErr.message);
    return NextResponse.json({ error: "Não foi possível salvar a foto agora. Tente de novo." }, { status: 502 });
  }

  // ?v= força o navegador a buscar a foto nova, já que o caminho não muda.
  const url = `${admin.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", check.userId);
  if (dbErr) {
    console.error("[profile/avatar] falha ao gravar a URL:", dbErr.message);
    return NextResponse.json({ error: "A foto subiu, mas não foi possível atualizar o perfil." }, { status: 500 });
  }

  return NextResponse.json({ url });
}

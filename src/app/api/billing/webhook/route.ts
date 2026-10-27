import { NextResponse } from "next/server";
import { validWebhookToken, verifyAndApply } from "@/lib/infinitepay";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Webhook da InfinitePay, chamado quando um pagamento é aprovado. O corpo não
// é assinado, então nada dele é aceito como verdade: o token da URL filtra
// chamadas que não vieram de um link nosso e verifyAndApply confirma o
// pagamento direto na API (payment_check) antes de liberar o acesso.
// Responder 400 faz a InfinitePay tentar de novo — usado só em falha
// transitória; payload inválido recebe 200 para não ficar em loop.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const orderNsu = typeof body?.order_nsu === "string" ? body.order_nsu : "";
  const tx = typeof body?.transaction_nsu === "string" ? body.transaction_nsu : "";
  const slug = typeof body?.invoice_slug === "string" ? body.invoice_slug : typeof body?.slug === "string" ? body.slug : "";
  const params = new URL(req.url).searchParams;
  const token = params.get("t");
  // Links novos trazem o nosso id em ?pid= (a InfinitePay troca o order_nsu);
  // nos antigos, o order_nsu do corpo é o nosso id.
  const pid = params.get("pid") || orderNsu;

  if (!UUID.test(pid) || !tx || !slug || !validWebhookToken(pid, token)) {
    console.warn("[billing/webhook] ignorado:", JSON.stringify({ campos: Object.keys(body || {}), pid: UUID.test(pid), tx: !!tx, slug: !!slug }));
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    const result = await verifyAndApply({
      paymentId: pid,
      providerOrderNsu: orderNsu || undefined,
      transactionNsu: tx,
      slug,
      receiptUrl: typeof body?.receipt_url === "string" ? body.receipt_url : null,
    });
    if (result.state === "not_paid") return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e: any) {
    console.error("[billing/webhook] erro:", e?.message);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { verifyAndApply } from "@/lib/infinitepay";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { monthLabel } from "@/lib/tuition";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Retorno do checkout de mensalidade (/mensalidade/retorno). Sem login,
// porque o responsável financeiro não tem conta: nada do corpo é aceito como
// verdade, a confirmação é sempre a consulta à InfinitePay (payment_check), e
// só pagamentos de mensalidade passam por aqui.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderNsu = typeof body?.order_nsu === "string" ? body.order_nsu : "";
  const tx = typeof body?.transaction_nsu === "string" ? body.transaction_nsu : "";
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!UUID.test(orderNsu) || !tx || !slug) {
    console.warn("[tuition/confirm] dados incompletos:", JSON.stringify({ campos: Object.keys(body || {}), orderNsu: UUID.test(orderNsu), tx: !!tx, slug: !!slug }));
    return NextResponse.json({ error: "Dados do pagamento incompletos." }, { status: 400 });
  }

  try {
    const result = await verifyAndApply({
      paymentId: orderNsu,
      transactionNsu: tx,
      slug,
      receiptUrl: typeof body?.receipt_url === "string" ? body.receipt_url : null,
      tuitionOnly: true,
    });
    if (result.state === "not_found") return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    if (result.state === "not_paid") return NextResponse.json({ paid: false });
    const { data: inv } = await supabaseAdmin().from("tuition_invoices").select("month").eq("id", result.invoiceId!).single();
    return NextResponse.json({ paid: true, monthLabel: inv ? monthLabel(inv.month) : null });
  } catch (e: any) {
    console.error("[tuition/confirm] erro:", e?.message);
    return NextResponse.json({ paid: false, retry: true });
  }
}

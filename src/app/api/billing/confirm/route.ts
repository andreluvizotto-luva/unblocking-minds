import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { verifyAndApply } from "@/lib/infinitepay";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chamado pela página /assinatura/retorno com os parâmetros que a
// InfinitePay coloca na redirect_url. Cobre o caso de o webhook atrasar:
// faz a mesma verificação (payment_check), só para o dono do pagamento.
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const orderNsu = typeof body?.order_nsu === "string" ? body.order_nsu : "";
  const tx = typeof body?.transaction_nsu === "string" ? body.transaction_nsu : "";
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!UUID.test(orderNsu) || !tx || !slug) {
    return NextResponse.json({ error: "Dados do pagamento incompletos." }, { status: 400 });
  }

  try {
    const result = await verifyAndApply({
      paymentId: orderNsu,
      transactionNsu: tx,
      slug,
      receiptUrl: typeof body?.receipt_url === "string" ? body.receipt_url : null,
      userId: user.id,
    });
    if (result.state === "not_found") return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    if (result.state === "not_paid") return NextResponse.json({ paid: false });
    return NextResponse.json({ paid: true, accessUntil: result.accessUntil });
  } catch (e: any) {
    console.error("[billing/confirm] erro:", e?.message);
    return NextResponse.json({ paid: false, retry: true });
  }
}

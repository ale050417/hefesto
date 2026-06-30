import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/session";
import { AccountShell } from "@/features/customers/components/account-shell";
import { formatPrice } from "@/lib/format";
import { AppError } from "@/core/errors";
import { ChatThread } from "@/features/custom/components/chat-thread";
import { ApproveQuote } from "@/features/custom/components/approve-quote";
import { CustomStatusBadge } from "@/features/custom/components/status-badge";
import { getRequestWithMessages } from "@/features/custom/service";

export const dynamic = "force-dynamic";

export default async function CustomRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/cuenta/a-medida/${id}`);

  let data;
  try {
    data = await getRequestWithMessages(id, user.id);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
  const { request, messages } = data;

  return (
    <AccountShell>
      <div className="grid gap-6">
        <Link
          href="/cuenta/a-medida"
          className="text-dim hover:text-fg text-sm"
        >
          ← Volver a A medida
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Pedido a medida</div>
            <h1 className="font-display text-2xl font-bold">{request.title}</h1>
          </div>
          <CustomStatusBadge status={request.status} />
        </div>

        <div className="ui-card grid gap-3 p-5">
          <p className="whitespace-pre-wrap">{request.description}</p>
          {request.referenceImageUrl ? (
            <a
              href={request.referenceImageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--gold)] underline"
            >
              Ver imagen de referencia
            </a>
          ) : null}
          {request.quotedAmount ? (
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
              <span className="text-dim">Cotización del taller</span>
              <span className="text-lg font-semibold text-[var(--gold)]">
                {formatPrice(Number(request.quotedAmount))}
              </span>
            </div>
          ) : null}
          {request.status === "quoted" ? (
            <div className="flex justify-end">
              <ApproveQuote requestId={request.id} />
            </div>
          ) : null}
        </div>

        <section className="ui-card grid gap-3 p-5">
          <h2 className="text-lg font-semibold">Chat con el taller</h2>
          <ChatThread
            requestId={request.id}
            messages={messages}
            viewerIsStaff={false}
          />
        </section>
      </div>
    </AccountShell>
  );
}

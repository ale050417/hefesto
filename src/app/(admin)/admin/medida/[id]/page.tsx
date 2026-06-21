import { notFound } from "next/navigation";
import { requireStaff } from "@/core/auth/session";
import { formatPrice } from "@/lib/format";
import { AppError } from "@/core/errors";
import { AdminManager } from "@/features/custom/components/admin-manager";
import { ChatThread } from "@/features/custom/components/chat-thread";
import { CustomStatusBadge } from "@/features/custom/components/status-badge";
import { getRequestWithMessages } from "@/features/custom/service";

export const dynamic = "force-dynamic";

export default async function AdminCustomDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  let data;
  try {
    data = await getRequestWithMessages(id);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
  const { request, messages } = data;

  return (
    <div className="grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Pedido a medida</div>
          <h1 className="page-title">{request.title}</h1>
        </div>
        <CustomStatusBadge status={request.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
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
                <span className="text-dim">Cotización enviada</span>
                <span className="font-semibold text-[var(--gold)]">
                  {formatPrice(Number(request.quotedAmount))}
                </span>
              </div>
            ) : null}
          </div>

          <section className="ui-card grid gap-3 p-5">
            <h2 className="text-lg font-semibold">Chat con el cliente</h2>
            <ChatThread
              requestId={request.id}
              messages={messages}
              viewerIsStaff
            />
          </section>
        </div>

        <AdminManager request={request} />
      </div>
    </div>
  );
}

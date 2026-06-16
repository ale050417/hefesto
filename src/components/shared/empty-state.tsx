import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="border-surface-3 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="eyebrow">Sin resultados</p>
      <h3 className="font-display text-fg mt-2 text-xl">{title}</h3>
      {description ? (
        <p className="text-dim mt-2 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

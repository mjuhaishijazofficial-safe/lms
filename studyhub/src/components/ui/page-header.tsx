import { Breadcrumbs, type Crumb } from "./breadcrumbs";

export function PageHeader({ title, description, crumbs, actions }: {
  title: string; description?: string; crumbs?: Crumb[]; actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 space-y-3">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

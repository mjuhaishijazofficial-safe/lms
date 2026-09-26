import { Breadcrumbs, type Crumb } from "./breadcrumbs";

export function PageHeader({ title, description, crumbs, actions }: {
  title: string; description?: string; crumbs?: Crumb[]; actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 space-y-2">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

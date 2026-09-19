import { cn } from "@/lib/format";

/** Card that scrolls sideways on small screens instead of squashing columns. */
export function TableCard({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </div>
  );
}

export function Table({ children, caption, className = "min-w-160" }: { children: React.ReactNode; caption: string; className?: string }) {
  return (
    <table className={cn("w-full text-left text-sm", className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
}

export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th scope="col" className={cn("whitespace-nowrap border-b border-line bg-page/60 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted", className)}>
    {children}
  </th>
);

export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={cn("border-b border-line px-5 py-3.5 align-middle", className)}>{children}</td>
);

/** Rows are dividers, not zebra stripes, to match the light card style of the reference. */
export const Tr = ({ children }: { children: React.ReactNode }) => <tr className="transition hover:bg-page/50 [&:last-child>td]:border-b-0">{children}</tr>;

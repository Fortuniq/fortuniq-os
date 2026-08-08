export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="font-display text-2xl font-black text-navy">{title}</h1>
        {description && <p className="text-sm text-grey mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

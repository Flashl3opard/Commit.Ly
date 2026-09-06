function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="mx-4 my-3 flex items-center gap-3" role="separator">
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-xs font-medium text-muted-2">{formatDayLabel(iso)}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

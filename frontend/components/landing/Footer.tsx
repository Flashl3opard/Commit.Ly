const COLUMNS = [
  {
    title: "Product",
    links: ["Features", "Docs", "Pricing"],
  },
  {
    title: "Company",
    links: ["About", "GitHub"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div>
          <span className="font-mono text-base font-semibold tracking-tight text-foreground">
            commit<span className="text-accent">.ly</span>
          </span>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Repo-native collaboration for developer teams.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 sm:gap-16">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="focus-ring text-sm text-muted transition-colors hover:text-foreground">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-border pt-6 text-xs text-muted-2">
        © {new Date().getFullYear()} Commit.ly. Built for developer teams.
      </div>
    </footer>
  );
}

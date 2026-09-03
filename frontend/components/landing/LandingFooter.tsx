import { GithubIcon } from "@/components/ui/GithubIcon";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "GitHub", href: "#github" },
      { label: "Features", href: "#features" },
    ],
  },
  {
    title: "Company",
    links: [{ label: "About", href: "#about" }],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div>
          <span className="flex items-center gap-2 font-mono text-base font-semibold tracking-tight text-foreground">
            <GithubIcon className="h-4 w-4 text-muted-2" />
            commit<span className="text-accent">.ly</span>
          </span>
          <p className="mt-2 max-w-xs text-sm text-muted-2">
            GitHub-native collaboration for teams that ship.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 sm:gap-14">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="focus-ring text-sm text-muted-2 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-5xl border-t border-border pt-6 text-xs text-muted-2">
        © {new Date().getFullYear()} Commit.ly.
      </div>
    </footer>
  );
}

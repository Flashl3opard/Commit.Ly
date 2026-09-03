"use client";

export const AVAILABLE_SKILLS = [
  "TypeScript",
  "JavaScript",
  "Python",
  "C++",
  "Java",
  "Go",
  "Rust",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "PostgreSQL",
  "Prisma",
  "Docker",
  "Git",
  "GitHub",
  "AWS",
] as const;

export const MAX_SKILLS = 8;

export function SkillsPicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
}) {
  const atLimit = selected.length >= MAX_SKILLS;

  function toggle(skill: string) {
    if (selected.includes(skill)) {
      onChange(selected.filter((s) => s !== skill));
    } else if (!atLimit) {
      onChange([...selected, skill]);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_SKILLS.map((skill) => {
          const isSelected = selected.includes(skill);
          const isDisabled = disabled || (!isSelected && atLimit);
          return (
            <button
              key={skill}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              onClick={() => toggle(skill)}
              className={`focus-ring rounded-full border px-3.5 py-1.5 font-mono text-sm transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-foreground"
              } ${isDisabled && !isSelected ? "cursor-not-allowed opacity-40" : ""}`}
            >
              {skill}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-2">
        {selected.length} / {MAX_SKILLS} selected
      </p>
    </div>
  );
}

"use client";

import { SkillsPicker } from "@/components/ui/SkillsPicker";

export function StepSkills({
  skills,
  onChange,
  disabled,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">What do you build with?</h1>
      <p className="mt-2 text-sm text-muted">Pick up to 8 technologies. Optional — skip if you&apos;d rather not.</p>

      <div className="mt-8">
        <SkillsPicker selected={skills} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

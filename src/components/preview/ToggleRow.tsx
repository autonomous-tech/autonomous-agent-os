"use client";

import { Switch } from "@/components/ui/switch";

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </label>
  );
}

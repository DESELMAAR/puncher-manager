import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  const inputId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="pm-label">
          {label}
        </label>
      ) : null}
      <input id={inputId} className={cn("pm-input", error && "border-red-400 focus:ring-red-500/30", className)} {...props} />
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-[var(--pm-muted)]">{hint}</p> : null}
    </div>
  );
}

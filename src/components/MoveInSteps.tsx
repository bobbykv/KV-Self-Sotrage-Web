import { MOVE_IN_STEPS } from "@/lib/move-in-steps";

export function MoveInSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {MOVE_IN_STEPS.map((step, index) => {
        const n = (index + 1) as 1 | 2 | 3;
        const state = n < current ? "done" : n === current ? "current" : "upcoming";
        return (
          <li
            key={step.title}
            className={`rounded-2xl border p-4 ${state === "current" ? "border-kv-navy bg-kv-navy-50" : state === "done" ? "border-kv-line bg-white" : "border-kv-line bg-white/60"}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <p className={`text-xs font-extrabold uppercase tracking-wide ${state === "current" ? "text-kv-red" : "text-kv-muted"}`}>
              {state === "done" ? `Step ${n} done` : `Step ${n}`}
            </p>
            <p className="mt-1 font-extrabold text-kv-navy">{step.title}</p>
            <p className="mt-1 text-sm text-kv-muted">{step.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}

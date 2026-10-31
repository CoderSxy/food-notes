import type { OwnerScope } from "@/lib/entry-types";
export default function ScopeSwitch({
  value,
  onChange,
}: {
  value: OwnerScope;
  onChange: (scope: OwnerScope) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="记录范围">
      {(["mine", "all"] as const).map((scope) => (
        <button
          key={scope}
          type="button"
          aria-pressed={value === scope}
          onClick={() => onChange(scope)}
        >
          {scope === "mine" ? "我的" : "全部"}
        </button>
      ))}
    </div>
  );
}

"use client";
import type { DictionaryItem } from "@/lib/foods";
export default function CuisinePicker({
  items,
  value,
  onChange,
}: {
  items: DictionaryItem[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend>菜系（可多选）</legend>
      <div className="choice-buttons choice-buttons--wrap">
        {items.map((item) => (
          <label className="choice-button choice-button--wrap" key={item.id}>
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, item.id]
                    : value.filter((id) => id !== item.id),
                )
              }
            />
            {item.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

"use client";

import { cn } from "@/lib/utils";
import type { Category } from "@/types/catalog";

interface CategoryNode extends Category {
  children: Category[];
}

/** Groups the flat category list into root + direct children — matches the one-level hierarchy the Chapter 12 seed data actually has; a category with no matching parent in the list is treated as root (defensive against a stale/missing parent). */
function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const roots: CategoryNode[] = [];
  const childrenByParent = new Map<string, Category[]>();

  for (const category of categories) {
    if (category.parentId && byId.has(category.parentId)) {
      const bucket = childrenByParent.get(category.parentId) ?? [];
      bucket.push(category);
      childrenByParent.set(category.parentId, bucket);
    }
  }
  for (const category of categories) {
    if (!category.parentId || !byId.has(category.parentId)) {
      roots.push({ ...category, children: childrenByParent.get(category.id) ?? [] });
    }
  }
  return roots;
}

/**
 * Single-select category list (the backend's `categoryId` filter accepts
 * exactly one value — see QueryProductDto) — never renders checkboxes,
 * only single-choice rows, so the UI can't imply a multi-select the API
 * doesn't support.
 */
export function CategoryFilterList({
  categories,
  value,
  onSelect,
}: {
  categories: Category[];
  value: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const tree = buildCategoryTree(categories);

  return (
    <div role="radiogroup" aria-label="Lọc theo danh mục" className="grid gap-1">
      <CategoryRow label="Tất cả sản phẩm" selected={value === null} onSelect={() => onSelect(null)} />
      {tree.map((root) => (
        <div key={root.id}>
          <CategoryRow label={root.name} selected={value === root.slug} onSelect={() => onSelect(root.slug)} />
          {root.children.length > 0 ? (
            <div className="ml-3 grid gap-1 border-l pl-2">
              {root.children.map((child) => (
                <CategoryRow
                  key={child.id}
                  label={child.name}
                  selected={value === child.slug}
                  onSelect={() => onSelect(child.slug)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CategoryRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-9 items-center rounded-lg px-3 py-2 text-left text-sm",
        selected
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

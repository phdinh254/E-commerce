"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProductAttribute } from "@/types/product-detail";

/**
 * Ch14-B133. Uses the base-ui Tabs primitive (accessible tablist/tab/tabpanel
 * roles and arrow-key navigation out of the box — see components/ui/tabs.tsx).
 * The description is rendered as plain text (whitespace preserved), never
 * via dangerouslySetInnerHTML: the backend stores `description` as a plain
 * `text` column (see product.entity.ts), not sanitized HTML, so treating it
 * as markup would both misrender literal text and open an XSS surface for
 * no benefit.
 */
export function ProductInfoTabs({
  description,
  attributes,
}: {
  description: string | null;
  attributes: ProductAttribute[];
}) {
  const sortedAttributes = [...attributes].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Tabs defaultValue="description">
      <TabsList>
        <TabsTrigger value="description">Mô tả</TabsTrigger>
        <TabsTrigger value="specs">Thông số kỹ thuật</TabsTrigger>
      </TabsList>
      <TabsContent value="description" className="pt-6">
        {description ? (
          <p className="whitespace-pre-line leading-7 text-muted-foreground">{description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sản phẩm này chưa có mô tả chi tiết.</p>
        )}
      </TabsContent>
      <TabsContent value="specs" className="pt-6">
        {sortedAttributes.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {sortedAttributes.map((attribute) => (
              <div key={attribute.id} className="rounded-xl bg-muted p-4">
                <dt className="text-xs font-medium text-muted-foreground">{attribute.name}</dt>
                <dd className="mt-2 font-semibold">
                  {attribute.value}
                  {attribute.unit ? ` ${attribute.unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Sản phẩm này chưa có thông số kỹ thuật.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}

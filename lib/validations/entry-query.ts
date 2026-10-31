import { z } from "zod";
export const ownerScopeSchema = z.enum(["mine", "all"]).default("mine");
const integer = (value: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(value);
const listSchema = z.object({
  scope: ownerScopeSchema,
  kind: z.enum(["place", "item"]).optional(),
  q: z.string().trim().max(100).default(""),
  page: integer(1, 100000),
  pageSize: integer(20, 100),
});
export type EntryQuery = z.infer<typeof listSchema>;
export function parseEntryQuery(params: URLSearchParams): EntryQuery {
  return listSchema.parse(Object.fromEntries(params));
}
const cursorSchema = z.object({
  created_at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export type MapCursor = z.infer<typeof cursorSchema>;
export function parseMapQuery(params: URLSearchParams) {
  const { scope, kind, cursor } = z
    .object({
      scope: ownerScopeSchema,
      kind: z.enum(["all", "place", "item"]).default("all"),
      cursor: z.string().max(512).optional(),
    })
    .parse(Object.fromEntries(params));
  let after: MapCursor | undefined;
  if (cursor) {
    try {
      after = cursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
      );
    } catch {
      throw new SyntaxError("分页游标无效");
    }
  }
  return { scope, kind, after };
}

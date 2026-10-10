// All persisted identifiers, including foreign and unique keys, share a namespace.
// Serialized domain data keeps logical IDs so exports and the UI remain readable.
const keys = new Set(["id", "rfqId", "quoteId", "idempotencyKey", "sku"]);
function mapKeys(
  value: unknown,
  transform: (value: string) => string,
  key = "",
): unknown {
  if (typeof value === "string")
    return keys.has(key) ? transform(value) : value;
  if (Array.isArray(value))
    return value.map((item) => mapKeys(item, transform, key));
  if (
    !value ||
    typeof value !== "object" ||
    value instanceof Date ||
    value instanceof Uint8Array
  )
    return value;
  return Object.fromEntries(
    Object.entries(value).map(([name, item]) => [
      name,
      name === "orderBy"
        ? item
        : mapKeys(item, transform, keys.has(key) ? key : name),
    ]),
  );
}
const readsAndBulkWrites = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);
const singleAndCreate = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "upsert",
  "delete",
]);
export function scopeQueryArgs(
  args: object,
  model: string,
  operation: string,
  prefix: string,
) {
  if (!readsAndBulkWrites.has(operation) && !singleAndCreate.has(operation)) {
    throw new Error(`Unsupported workspace operation: ${operation}`);
  }
  const scoped = mapKeys(args, (value) => prefix + value) as Record<
    string,
    unknown
  >;
  if (readsAndBulkWrites.has(operation)) {
    const key = model === "CatalogItem" ? "sku" : "id";
    scoped.where = {
      AND: [scoped.where || {}, { [key]: { startsWith: prefix } }],
    };
  }
  return scoped;
}
export function logicalResult(value: unknown, prefix: string) {
  return mapKeys(value, (key) =>
    key.startsWith(prefix) ? key.slice(prefix.length) : key,
  );
}

declare module "pdf-parse/lib/pdf-parse.js" {
  const parse: (
    data: Buffer,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  export default parse;
}

/**
 * Minimal Cloudflare runtime declarations used by the vinext worker build.
 * Production bindings are supplied by Sites at deploy time.
 */
declare type D1Database = unknown;

declare interface Fetcher {
  fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    [binding: string]: unknown;
  };
}

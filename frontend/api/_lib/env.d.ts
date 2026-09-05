// Vercel's Edge Runtime exposes a minimal process.env for reading configured
// environment variables at request time — nothing else on `process` is
// available (no fs, no full Node API), so this declares only that.
declare const process: {
  env: Record<string, string | undefined>;
};

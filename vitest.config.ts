import { defineConfig } from "vitest/config";

// Integration tests run against famerace_test (created alongside the dev DB).
// npm run test applies migrations first — see the "test" script in package.json.
export default defineConfig({
  test: {
    dir: "packages/core/test",
    fileParallelism: false, // tests share one database; run files serially
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://famerace:famerace@localhost:5432/famerace_test",
      // Small launch gate so threshold transitions are testable (config env overrides).
      LAUNCH_REQUIRED_BACKERS: "2",
      LAUNCH_REQUIRED_DEMAND_CENTS: "20000",
      // The whole suite runs on the native USDC rail — every money flow
      // exercises real holds/captures against wallet balances.
      PAYMENT_PROVIDER: "usdc",
      DEV_FAUCET: "1",
    },
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

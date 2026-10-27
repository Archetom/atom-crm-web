import { reactRouter } from "@react-router/dev/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

function enabled(value: string | undefined): boolean {
  return value === "true";
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  if (command === "build" && mode === "production" && enabled(environment.VITE_ENABLE_DEV_AUTH)) {
    throw new Error("VITE_ENABLE_DEV_AUTH must not be enabled for a production build.");
  }

  return {
    plugins: [reactRouter()],
    optimizeDeps: {
      // Discover route dependencies before the first browser request so cold
      // starts do not invalidate already served optimized dependency URLs.
      entries: ["app/root.tsx", "app/routes/**/*.tsx"],
    },
    build: {
      // Pinned explicitly rather than inherited from Vite's `baseline-widely-available`
      // default, because that keyword moves its browser floor with each Vite major and
      // would change the shipped support matrix without any change here.
      // Kept in sync with the matrix in docs/deployment.md.
      target: ["chrome107", "edge107", "firefox104", "safari16"],
    },
    resolve: {
      alias: {
        "~": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: environment.VITE_API_PROXY_TARGET || "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
    ssr: {
      // The package's ESM entry imports extensionless local modules. Let Vite transform it
      // during development instead of asking Node's strict ESM resolver to load it directly.
      noExternal: ["@ant-design/icons"],
    },
  };
});

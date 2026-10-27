import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Ant Design v6 keeps these props working but warns at runtime and removes them in v7.
 * The codebase is fully migrated; this rule stops the deprecated spelling coming back.
 * See https://ant.design/docs/react/migration-v6.
 */
const deprecatedAntdProps = [
  { component: "Alert", from: "message", to: "title" },
  { component: "Spin", from: "tip", to: "description" },
  { component: "Space", from: "direction", to: "orientation" },
  { component: "Modal", from: "destroyOnClose", to: "destroyOnHidden" },
  { component: "Drawer", from: "destroyOnClose", to: "destroyOnHidden" },
].map(({ component, from, to }) => ({
  selector: `JSXOpeningElement[name.name="${component}"] > JSXAttribute[name.name="${from}"]`,
  message: `<${component} ${from}> is deprecated in Ant Design v6 and removed in v7. Use \`${to}\`.`,
}));

export default tseslint.config(
  {
    ignores: ["build", "coverage", "node_modules", ".react-router", "playwright-report"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, allowExportNames: ["meta"] },
      ],
      "no-restricted-syntax": ["error", ...deprecatedAntdProps],
    },
  },
  {
    // The API layer is the lowest layer. It must not depend on a business vertical.
    files: ["src/api/**/*.{ts,tsx}"],
    ignores: ["src/api/client/api-client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/features/*", "~/features/*/**"],
              message:
                "src/api must not import a feature. Declare the endpoint and its decoder inside the owning feature instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // A feature's UI reaches another feature only through its public index.
    files: ["src/features/*/components/**/*.{ts,tsx}", "src/features/*/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/features/*/*", "~/features/*/**"],
              message:
                "Import another feature through its public index (`~/features/<name>`), not an internal path.",
            },
          ],
        },
      ],
    },
  },
  {
    // A model may depend on another feature's model, but never on its components or
    // pages: a feature index also exports UI bound to the app bootstrap context, and
    // routing model types through it would cycle back into the API client.
    files: ["src/features/*/model/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/features/*/components/**", "~/features/*/pages/**"],
              message: "A feature model must not depend on another feature's components or pages.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.{js,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
);

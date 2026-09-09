/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  settings: { react: { version: "detect" } },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  ignorePatterns: [
    "dist",
    "node_modules",
    "src-tauri",
    "core",
    "target",
    "designs",
    "*.cjs",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "react/prop-types": "off",
    // designs/ is frozen reference material and must never be imported at runtime.
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/designs/**", "designs/*", "../designs/*"],
            message:
              "designs/ is reference-only — port the code into src/, never import it.",
          },
        ],
      },
    ],
  },
};

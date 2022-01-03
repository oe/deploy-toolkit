module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: {
    project: "./tsconfig.json",
  },
  rules: {
    "no-underscore-dangle": ["off"],
    "no-nested-ternary": ["off"],
    "no-console": ["off"],
    "import/prefer-default-export": ["off"],
    "prefer-promise-reject-errors": ["off"],
    "@typescript-eslint/comma-dangle": ["off"],
    "@typescript-eslint/no-non-null-assertion": ["off"],
    "@typescript-eslint/no-throw-literal": ["off"],
    "@typescript-eslint/no-unused-expressions": ["off"],
    "@typescript-eslint/no-explicit-any": ["off"],
    semi: "off",
    "@typescript-eslint/semi": ["error", "never"],
  },
  env: {
    node: true
  }
}

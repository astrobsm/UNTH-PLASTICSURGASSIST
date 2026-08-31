/**
 * Lint configuration.
 *
 * THIS FILE DID NOT LOAD FOR A LONG TIME. `extends` named the shareable configs
 * as '@typescript-eslint/recommended' and 'eslint-plugin-react-hooks/recommended',
 * neither of which resolves — the eslintrc form is 'plugin:<name>/recommended'.
 * ESLint therefore aborted before linting anything, `npm run lint` failed with a
 * config error rather than a report, and the gate was dead for as long as that
 * went unnoticed. Roughly 3,500 findings had accumulated behind it.
 *
 * ON THE WARNING BUDGET
 * `npm run lint` allows a fixed number of warnings, and that number is a
 * ratchet: it exists to be lowered, never raised. Most of the remaining budget
 * is `no-explicit-any` across 234 files. Typing those properly means pinning
 * down the shape of every API response and stored row in a clinical record
 * system; done carelessly it changes behaviour in code that renders patient
 * data, so it is deliberately left as visible, counted debt rather than either
 * rushed or switched off.
 */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // A leftover binding is hygiene, not a defect, and holding the build to
    // ransom over one is why nobody ran this. It still shows in the editor and
    // still counts against the budget, so it cannot quietly accumulate.
    // A parameter kept only to satisfy a signature should be named with a
    // leading underscore to say so.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}
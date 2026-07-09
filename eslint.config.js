// ESLint flat config (v9). Minimal — zero runtime deps; run lint with: npm i -D eslint && npx eslint src test
export default [
  { languageOptions: { ecmaVersion: 2023, sourceType: 'module' } },
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  { ignores: ['examples/**'] },
];

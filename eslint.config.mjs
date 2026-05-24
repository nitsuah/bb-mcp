import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended'; // Combines plugin and config

export default tseslint.config(
  // Base ESLint recommended rules for JavaScript
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs
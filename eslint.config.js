import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'supabase'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      // Classic React Hooks lint (rules-of-hooks + exhaustive-deps). The
      // react-hooks v7 "recommended" preset now also bundles the opinionated
      // React Compiler rule set; we scope to the two long-standing rules to
      // avoid mass churn on this pre-existing codebase.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Honor the `_`-prefix intentional-unused convention, matching tsconfig's
      // noUnusedLocals/noUnusedParameters behavior.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // This codebase's context providers deliberately co-locate the Provider
      // component with its hook/constants in one file; fast refresh still works
      // for the provider itself, so surface this as a warning rather than an error.
      'react-refresh/only-export-components': 'warn',
    },
  },
)

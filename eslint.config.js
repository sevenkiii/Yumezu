import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * 引擎层目录：必须保持纯粹、确定、可移植。
 * 这些目录不得依赖浏览器 / Node 环境，也不得使用不可复现的随机源。
 */
const PURE_DIRS = [
  'src/core/**/*.ts',
  'src/map/**/*.ts',
  'src/rules/**/*.ts',
  'src/characters/**/*.ts',
  'src/cards/**/*.ts',
];

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: PURE_DIRS,
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: '禁止直接使用 Math.random()；请使用注入的 RNG（见 RULES.md「随机数」）。',
        },
        {
          object: 'Date',
          property: 'now',
          message: '核心逻辑必须确定性，禁止使用 Date.now()。',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: '核心逻辑必须确定性，禁止读取当前时间。',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: '核心逻辑不得依赖浏览器环境。' },
        { name: 'document', message: '核心逻辑不得依赖浏览器环境。' },
        { name: 'localStorage', message: '核心逻辑不得依赖浏览器环境。' },
        { name: 'fetch', message: '核心逻辑不得依赖网络环境。' },
        { name: 'process', message: '核心逻辑不得依赖 Node 环境。' },
      ],
    },
  },

  // 必须放在最后：关闭所有与 Prettier 冲突的格式化规则。
  prettier,
);

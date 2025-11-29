/**
 * ESLint 配置文件
 * 用于 TypeScript + React + Vite 项目的代码质量和风格检查
 */
module.exports = {
  // 标记为根配置文件，停止在父目录中查找配置
  root: true,

  // 指定代码运行环境，启用相关全局变量
  env: {
    browser: true, // 浏览器环境（window, document 等）
    es2021: true, // ES2021 语法支持
    node: true, // Node.js 环境（module, process 等）
  },

  // 使用 TypeScript ESLint 解析器来解析 TypeScript 代码
  parser: '@typescript-eslint/parser',

  // 解析器选项
  parserOptions: {
    ecmaVersion: 'latest', // 使用最新的 ECMAScript 版本
    sourceType: 'module', // 使用 ES 模块
  },

  // 共享设置，供所有规则使用
  settings: {
    react: {
      version: 'detect', // 自动检测 React 版本
    },
  },

  // 启用的插件列表
  plugins: [
    '@typescript-eslint', // TypeScript ESLint 插件
    'react-refresh', // React Fast Refresh 支持
    'import', // 导入/导出语句检查和排序
    // 注意：prettier 插件通过 'plugin:prettier/recommended' 自动启用，无需单独声明
  ],

  // 继承的配置预设（按顺序应用）
  // 注意：prettier 必须放在最后，以覆盖可能与 Prettier 冲突的格式规则
  extends: [
    'eslint:recommended', // ESLint 推荐规则
    'plugin:@typescript-eslint/recommended', // TypeScript 推荐规则
    'plugin:react-hooks/recommended', // React Hooks 规则
    'plugin:import/recommended', // 导入/导出推荐规则
    'plugin:import/typescript', // TypeScript 导入类型检查
    // 'plugin:prettier/recommended' 等价于以下配置：
    // 1. extends: ['prettier'] - eslint-config-prettier：关闭与 Prettier 冲突的 ESLint 格式规则
    // 2. plugins: ['prettier'] - eslint-plugin-prettier：启用 Prettier 作为 ESLint 规则
    // 3. rules: { 'prettier/prettier': 'error' } - 将 Prettier 格式问题作为 ESLint 错误
    'plugin:prettier/recommended',
  ],

  // 自定义规则配置
  rules: {
    // React Fast Refresh：仅在文件只导出组件时启用热更新
    // allowConstantExport: true 允许导出常量
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

    // TypeScript：未使用的变量警告
    // argsIgnorePattern: '^_' 忽略以下划线开头的参数（如 _unused）
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // 导入语句排序规则
    'import/order': [
      'warn',
      {
        // 导入分组顺序：内置模块 -> 外部包 -> 内部模块 -> 父级目录 -> 同级目录 -> 索引文件 -> 对象导入 -> 类型导入
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        // 每个分组之间必须有空行
        'newlines-between': 'always',
        // 按字母顺序排序（不区分大小写）
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },

  // 针对特定文件覆盖规则
  overrides: [
    {
      // Context 文件通常导出多个 hooks 和类型，不需要严格遵循组件导出限制
      files: ['src/context/**/*.{ts,tsx}'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],

  // 忽略的文件和目录（不进行 ESLint 检查）
  ignorePatterns: ['dist', 'node_modules', 'src-tauri', '*.config.*'],
}


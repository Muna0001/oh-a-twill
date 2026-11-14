const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'reference/*', 'fixtures/*', '.expo/*', 'docs/*'] },
  {
    // The engine is pure TypeScript: it must run under plain Node.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'expo', 'expo-*', '@expo/*', '@react-native*', 'zustand*'], message: 'src/engine must stay pure TypeScript.' },
            { group: ['@/catalog*', '@/store*', '@/ui*', '@/weave*', '@/media*', '@/platform*', '@/features*', '@/app*'], message: 'src/engine must not import upward.' },
          ],
        },
      ],
    },
  },
]);

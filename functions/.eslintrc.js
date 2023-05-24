module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    'ecmaVersion': 2022,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  rules: {
    'max-len': 'off',
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'quotes': ['error', 'single', {'allowTemplateLiterals': true}],
  },
  overrides: [
    {
      files: ['**/*.spec.*'],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};

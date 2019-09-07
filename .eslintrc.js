module.exports = {
  root: true,

  parserOptions: {
    parser: 'babel-eslint',
    sourceType: 'module'
  },

  env: {
    browser: true,
  },

  extends: [
    'airbnb-base',
  ],

  // required to lint *.vue files
  plugins: [
    'chai-friendly',
  ],

  globals: {
    'web3': true,
    'artifacts': true,
    'contract': true,
    'it': true,
    'before': true,
    'beforeEach': true,
    'afterEach': true,
    'describe': true,
  },

  // add your custom rules here
  rules: {
    'no-param-reassign': 'off',

    'import/first': 'off',
    'import/named': 'error',
    'import/namespace': 'error',
    'import/default': 'error',
    'import/export': 'error',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 'off',
    'prefer-promise-reject-errors': 'off',

    // allow console.log during development only
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    // allow debugger during development only
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',

    'max-len': [1, 120, 2],
  }
}

/**
 * Every name used in the serverless API must be defined or imported.
 * A missing import is invisible to tsc (the API is plain JS) and to the build,
 * and only fails when the route runs in production (it once 500'd the duty
 * chase with "buildDutyChase is not defined").
 */
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

describe('API files have no undefined names', () => {
  it('no-undef across api/**/*.js', async () => {
    const eslint = new ESLint({
      useEslintrc: false,
      ignore: false,
      overrideConfig: {
        env: { node: true, es2022: true },
        parserOptions: { sourceType: 'module', ecmaVersion: 'latest' },
        rules: { 'no-undef': 'error' },
      },
    });
    const results = await eslint.lintFiles(['api/**/*.js']);
    const problems = results.flatMap(r => r.messages.map(m => `${r.filePath.replace(/.*[\/]api[\/]/, 'api/')}:${m.line} ${m.message}`));
    expect(problems).toEqual([]);
  }, 120_000);
});

/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import postcss, { type AtRule, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const stylesheet = fs.readFileSync(path.resolve('src/styles/global.css'), 'utf8');
const root = postcss.parse(stylesheet);

function landscapeRule(selector: string): Rule | undefined {
  let match: Rule | undefined;
  root.walkAtRules('media', (atRule: AtRule) => {
    if (!atRule.params.includes('orientation: landscape')) return;
    atRule.walkRules((rule) => {
      if (rule.selector === selector) match = rule;
    });
  });
  return match;
}

function declarations(rule: Rule | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  rule?.walkDecls((decl) => {
    result[decl.prop] = decl.value;
  });
  return result;
}

describe('mobile live player layout', () => {
  it('places the player and channel list side by side in landscape', () => {
    expect(declarations(landscapeRule('[data-live-channel-layout]'))).toMatchObject({
      'flex-direction': 'row',
    });
    expect(declarations(landscapeRule('[data-live-player-panel]'))).toMatchObject({
      width: '66.666667%',
      height: '100%',
      'aspect-ratio': 'auto',
    });
    expect(declarations(landscapeRule('[data-live-channel-list]'))).toMatchObject({
      width: '33.333333%',
      height: '100%',
    });
  });

  it('keeps the persistent video aligned with the landscape player panel', () => {
    expect(declarations(landscapeRule('#av-player[data-active][data-live-channel-layout]'))).toMatchObject({
      width: '66.666667%',
      height: '100dvh',
    });
  });
});

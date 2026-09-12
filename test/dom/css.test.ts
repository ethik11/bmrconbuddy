import { describe, expect, it } from 'vitest';
import { CssInjector } from '../../src/dom/css';

describe('CssInjector.buildRules', () => {
  it('includes theme CSS variables and settings chrome', () => {
    const css = CssInjector.buildRules().join('\n');
    expect(css).toContain('--bss-feed-mod:');
    expect(css).toContain('var(--bss-hl-warn)');
    expect(css).toContain('.bss-toolkit-settings-gear');
    expect(css).toContain('.bss-toolkit-settings-panel');
  });
});

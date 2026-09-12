import { RULE_HIDDEN_CLASS } from '../constants';
import { createStyleOverride } from '../dom/style-override';
import type { HighlightAction } from '../types';

const addedClasses = new WeakMap<HTMLElement, Set<string>>();
const setBorder = createStyleOverride('border-left', [
  'border-left-width',
  'border-left-style',
  'border-left-color',
]);

function addRuleClass(el: HTMLElement, className: string): void {
  if (el.classList.contains(className)) return;
  const classes = addedClasses.get(el) ?? new Set<string>();
  classes.add(className);
  addedClasses.set(el, classes);
  el.classList.add(className);
}

/** Clear only effects owned by the preceding rule pass, including removed rules. */
export function resetHighlightActions(el: HTMLElement): void {
  for (const className of addedClasses.get(el) ?? []) el.classList.remove(className);
  addedClasses.delete(el);
  setBorder(el, null);
}

/** Called for each matching rule after resetting the previous pass once. */
export function applyHighlightActions(el: HTMLElement, actions: HighlightAction[]): void {
  if (!actions) return;
  for (const action of actions) {
    if (!action) continue;
    if (action.type === 'setRowClass' && action.className) addRuleClass(el, action.className);
    if (action.type === 'setBorderColor' && action.borderColor) {
      setBorder(el, '3px solid ' + action.borderColor);
    }
    // The text filter owns a separate class; either source can keep a row hidden.
    if (action.type === 'hideRow') addRuleClass(el, RULE_HIDDEN_CLASS);
  }
}

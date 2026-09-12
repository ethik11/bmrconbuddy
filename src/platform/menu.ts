import { GM_registerMenuCommand } from '$';

/** Tampermonkey/Violentmonkey script-menu entry. No-ops when the GM API is missing. */
export function registerToolkitMenuCommand(caption: string, onClick: () => void): void {
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(caption, onClick);
  }
}

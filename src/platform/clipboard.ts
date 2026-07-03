import { GM_setClipboard } from '$';

/** Copy `text` to the clipboard, preferring GM_setClipboard with graceful fallbacks. */
export function copyTextToClipboard(text: string, cb?: (ok: boolean) => void): void {
  const done = (ok: boolean): void => {
    if (cb) cb(!!ok);
  };

  if (typeof GM_setClipboard === 'function') {
    try {
      GM_setClipboard(text, 'text');
      done(true);
      return;
    } catch {}
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => done(true))
      .catch(() => legacyCopyTextToClipboard(text, done));
    return;
  }

  legacyCopyTextToClipboard(text, done);
}

function legacyCopyTextToClipboard(text: string, cb: (ok: boolean) => void): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {}
  ta.remove();
  cb(ok);
}

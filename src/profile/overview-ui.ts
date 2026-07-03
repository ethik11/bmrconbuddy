import { PROFILE_OVERVIEW_ACTIONS_ATTR, PROFILE_PATH_ATTR } from '../constants';
import { copyTextToClipboard } from '../platform/clipboard';
import { extractProfilePlayerCopyInfo, formatCopyPlayerInfoBlock } from './copy-info';
import { findProfileCopyAnchorH1, isProfileOverviewTab } from './identifiers';
import {
  NOTE_TEMPLATE_REASONS,
  buildNoteTemplateText,
  fillProfileNoteEditor,
} from './note-templates';

/**
 * Mounted under h1 on the Overview tab only: a "Copy Player Info" button plus a
 * Warn/Kick "Note Menu" that fills the ProseMirror editor. The document-level
 * outside-click listener is bound exactly once for the page's lifetime (and, as
 * in the original, never unbound).
 */
export const PlayerProfileOverviewUi = {
  outsideClickBound: false,

  removeAll(): void {
    const nodes = document.querySelectorAll('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
    for (let i = 0; i < nodes.length; i++) nodes[i].remove();
  },

  removeStaleInjections(): void {
    const nodes = document.querySelectorAll('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i].getAttribute(PROFILE_PATH_ATTR);
      if (p && p !== location.pathname) nodes[i].remove();
    }
  },

  buildNoteMenu(root: HTMLElement): void {
    const wrap = document.createElement('div');
    wrap.className = 'bss-toolkit-note-menu';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'bss-toolkit-btn bss-toolkit-btn--block';
    toggle.textContent = 'Note Menu';

    const menu = document.createElement('div');
    menu.className = 'bss-toolkit-note-dropdown';

    const submenu = document.createElement('div');
    submenu.className = 'bss-toolkit-note-dropdown bss-toolkit-note-submenu';

    function closeAll(): void {
      menu.classList.remove('is-open');
      submenu.classList.remove('is-open');
    }

    (['Warn', 'Kick'] as const).forEach((action) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = action;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        submenu.innerHTML = '';
        NOTE_TEMPLATE_REASONS.forEach((reason) => {
          const reasonBtn = document.createElement('button');
          reasonBtn.type = 'button';
          reasonBtn.textContent = reason;
          reasonBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            fillProfileNoteEditor(buildNoteTemplateText(action, reason));
            closeAll();
          });
          submenu.appendChild(reasonBtn);
        });
        submenu.classList.add('is-open');
        menu.classList.remove('is-open');
      });
      menu.appendChild(item);
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.contains('is-open');
      closeAll();
      if (!open) menu.classList.add('is-open');
    });

    if (!PlayerProfileOverviewUi.outsideClickBound) {
      PlayerProfileOverviewUi.outsideClickBound = true;
      document.addEventListener('click', () => {
        const opens = document.querySelectorAll(
          '.bss-toolkit-note-dropdown.is-open, .bss-toolkit-note-submenu.is-open',
        );
        for (let i = 0; i < opens.length; i++) opens[i].classList.remove('is-open');
      });
    }

    wrap.appendChild(toggle);
    wrap.appendChild(menu);
    wrap.appendChild(submenu);
    root.appendChild(wrap);
  },

  onCopyClick(btn: HTMLButtonElement): void {
    const info = extractProfilePlayerCopyInfo();
    const text = formatCopyPlayerInfoBlock(info);
    const label = btn.getAttribute('data-label-default') || 'Copy Player Info';
    copyTextToClipboard(text, (ok) => {
      if (!ok) {
        btn.textContent = 'Copy failed';
        setTimeout(() => {
          btn.textContent = label;
        }, 1600);
        return;
      }
      btn.textContent = 'Copied!';
      btn.classList.add('bss-toolkit-btn--copied');
      setTimeout(() => {
        btn.textContent = label;
        btn.classList.remove('bss-toolkit-btn--copied');
      }, 1400);
    });
  },

  run(): void {
    if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;

    this.removeStaleInjections();

    if (!isProfileOverviewTab()) {
      this.removeAll();
      return;
    }

    const h1 = findProfileCopyAnchorH1();
    if (!h1) {
      this.removeAll();
      return;
    }

    const existing = document.querySelector('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
    if (
      existing &&
      existing.getAttribute(PROFILE_PATH_ATTR) === location.pathname &&
      existing.previousElementSibling === h1
    ) {
      return;
    }

    if (existing) existing.remove();

    const root = document.createElement('div');
    root.className = 'bss-toolkit-profile-actions';
    root.setAttribute(PROFILE_OVERVIEW_ACTIONS_ATTR, '1');
    root.setAttribute(PROFILE_PATH_ATTR, location.pathname);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'bss-toolkit-btn bss-toolkit-btn--block bss-toolkit-btn--primary';
    copyBtn.textContent = 'Copy Player Info';
    copyBtn.setAttribute('data-label-default', 'Copy Player Info');
    copyBtn.addEventListener('click', () => {
      PlayerProfileOverviewUi.onCopyClick(copyBtn);
    });
    root.appendChild(copyBtn);

    this.buildNoteMenu(root);
    h1.insertAdjacentElement('afterend', root);
  },
};

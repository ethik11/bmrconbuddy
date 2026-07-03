/**
 * Warn/Kick note templates for the profile Overview "Note Menu".
 * The template text and reason list are ported verbatim from the monolith.
 */

const NOTE_TEMPLATE_VERBS: Record<string, string> = {
  Warn: 'Warned',
  Kick: 'Kicked',
};

export const NOTE_TEMPLATE_REASONS: string[] = [
  'Trolling',
  'Teamkilling',
  'Asset Wasting',
  'Squad Edging',
  'Armor Rules',
  'MBT Rules',
  'Heli Rules',
  'Maincamping',
  'Practice flying',
  'Seeding Rules',
  'Spawn Camping',
  'No Mic SL',
];

const NOTE_TEMPLATE_DETAILS: Record<string, string> = {
  Trolling: 'Trolling',
  Teamkilling: 'Teamkilling',
  'Asset Wasting': 'Asset Wasting',
  'Squad Edging': 'Squad Seeding',
  'Armor Rules': 'Breaking Armor Rules, leaving Main without a second Crewman',
  'MBT Rules': 'Breaking MBT Rules, having INF in a MBT squad',
  'Heli Rules':
    'Breaking Heli Rules, Flying a Heli with a Squad with more than 4 people in the Squad',
  Maincamping: 'Maincamping',
  'Practice flying': 'Not being able to Fly the Heli without Crashing',
  'Seeding Rules': 'Breaking Seeding Rules',
  'Spawn Camping': 'Spawn Camping on Jensens',
  'No Mic SL': 'having No Mic as SL',
};

export function buildNoteTemplateText(action: string, reasonKey: string): string {
  const verb = NOTE_TEMPLATE_VERBS[action] || 'Warned';
  const detail = NOTE_TEMPLATE_DETAILS[reasonKey] || reasonKey;
  return 'Player was ' + verb + ' for ' + detail;
}

/** Fill the ProseMirror note editor with `text`. Returns false when the editor is absent. */
export function fillProfileNoteEditor(text: string): boolean {
  const t = document.querySelector<HTMLElement>('.tiptap.ProseMirror[contenteditable="true"]');
  if (!t) return false;
  t.innerHTML = '<p>' + text + '</p>';
  t.focus();
  try {
    const sel = window.getSelection();
    if (sel) sel.collapse(t, 1);
  } catch {}
  return true;
}

import { describe, it, expect } from 'vitest';
import {
  buildNoteTemplateText,
  fillProfileNoteEditor,
  NOTE_TEMPLATE_REASONS,
} from '../../src/profile/note-templates';

describe('buildNoteTemplateText', () => {
  it('builds "Player was <verb> for <detail>"', () => {
    expect(buildNoteTemplateText('Warn', 'Trolling')).toBe('Player was Warned for Trolling');
    expect(buildNoteTemplateText('Kick', 'Heli Rules')).toBe(
      'Player was Kicked for Breaking Heli Rules, Flying a Heli with a Squad with more than 4 people in the Squad',
    );
  });

  it('falls back to the raw reason key when unknown', () => {
    expect(buildNoteTemplateText('Warn', 'Some New Reason')).toBe(
      'Player was Warned for Some New Reason',
    );
  });

  it('falls back to "Warned" for an unknown action', () => {
    expect(buildNoteTemplateText('Bogus', 'Trolling')).toBe('Player was Warned for Trolling');
  });

  it('has a detail entry for every listed reason', () => {
    for (const reason of NOTE_TEMPLATE_REASONS) {
      expect(buildNoteTemplateText('Warn', reason)).toMatch(/^Player was Warned for .+/);
    }
  });
});

describe('fillProfileNoteEditor', () => {
  it('returns false when the ProseMirror editor is absent', () => {
    document.body.innerHTML = '';
    expect(fillProfileNoteEditor('hi')).toBe(false);
  });

  it('fills the editor and returns true when present', () => {
    document.body.innerHTML = '<div class="tiptap ProseMirror" contenteditable="true"></div>';
    expect(fillProfileNoteEditor('Player was Warned for Trolling')).toBe(true);
    const editor = document.querySelector('.tiptap.ProseMirror');
    expect(editor?.innerHTML).toBe('<p>Player was Warned for Trolling</p>');
  });
});

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readAnatomyAudit } from '../../scripts/anatomy-audit';
import { questionsFromAudit } from '../../scripts/quiz-catalog';
import { parseAnatomyModel } from '../../src/features/anatomy/model';
import { previewTargets } from '../../src/features/anatomy/targets';
import { defaultAppearance } from '../../src/features/anatomy/visuals/appearance';
import {
  createFocusMaterials,
  planFocus,
  targetFrame,
} from '../../src/features/anatomy/visuals/materials';
import { gradeAnswer, type Question } from '../../src/features/quiz/questions';

const root = fileURLToPath(new URL('../../', import.meta.url));
const masseter: Question = {
  target: previewTargets[0],
  name: 'Masseter',
  kind: 'muscle',
  acceptedAnswers: ['Masseter'],
  explanation: '',
  hint: '',
  citations: [],
  figureLabel: '',
  shownSide: 'left',
  sidePolicy: 'either',
};

describe('strict grading', () => {
  it('normalizes case, spaces, and modest punctuation without fuzzy matching', () => {
    for (const answer of [
      'Masseter',
      '  masseter muscle  ',
      'MÁSSETER',
      '  Masseter-Muscle! ',
      'Left Masseter',
    ]) {
      expect(gradeAnswer(masseter, answer)).toBe(answer !== 'MÁSSETER');
    }
    for (const answer of [
      'temporalis',
      'maseter',
      'right masseter',
      'masseter and temporalis',
      '',
    ]) {
      expect(gradeAnswer(masseter, answer)).toBe(false);
    }
    expect(gradeAnswer({ ...masseter, sidePolicy: 'left' }, 'Masseter')).toBe(
      false,
    );
    expect(
      gradeAnswer({ ...masseter, sidePolicy: 'left' }, 'Left Masseter'),
    ).toBe(true);
  });

  it('only accepts explicit aliases for muscle groups', () => {
    const group: Question = {
      ...masseter,
      kind: 'group',
      name: 'Adductor muscles',
      acceptedAnswers: ['Adductor muscles', 'Adductor muscle'],
    };
    expect(gradeAnswer(group, 'Adductor muscle')).toBe(true);
    expect(gradeAnswer(group, 'Adductor longus')).toBe(false);
    expect(gradeAnswer(group, 'Adductor')).toBe(false);
  });
});

describe('eligibility and rendering', () => {
  it('excludes pending, rejected and unresolved records and fails closed on audit errors', async () => {
    const audit = await readAnatomyAudit(root);
    expect(questionsFromAudit(audit).map(({ target }) => target.id)).toEqual(
      audit.rows
        .filter(({ reviewState }) => reviewState === 'approved')
        .map(({ id }) => id),
    );
    expect(() =>
      questionsFromAudit({ ...audit, errors: ['Invalid model'] }),
    ).toThrow('Invalid model');
    const mapped = audit.rows.find((row) => row.id === 'masseter');
    const unresolved = audit.rows.find(
      (row) => row.mappingStatus === 'missing',
    );
    if (!mapped || !unresolved) throw new Error('Missing test records');
    const decision = {
      state: 'approved' as const,
      reviewer: 'Test fixture',
      date: '2026-11-12',
      mappingFingerprint: mapped.mappingFingerprint,
      note: 'Synthetic unit-test decision',
    };
    const approved = {
      ...mapped,
      reviewState: 'approved' as const,
      captureValid: true,
      decision,
    };
    expect(
      questionsFromAudit({
        ...audit,
        rows: [
          { ...approved, captureValid: false },
          { ...unresolved, decision },
        ],
      }),
    ).toEqual([]);
    expect(
      questionsFromAudit({
        ...audit,
        rows: [{ ...approved, reviewState: 'rejected' }],
      }),
    ).toEqual([]);
    const questions = questionsFromAudit({
      ...audit,
      rows: [approved, unresolved],
    });
    expect(questions.map(({ name }) => name)).toEqual(['Masseter']);
    expect(questions[0]?.target.selectors.map(({ name }) => name)).toEqual(
      previewTargets[0].selectors.map(({ name }) => name),
    );
    expect(questions[0]?.citations.length).toBeGreaterThan(0);
    expect(() =>
      questionsFromAudit({
        ...audit,
        rows: [
          {
            ...approved,
            decision: { ...decision, acceptedAnswers: ['Temporalis muscle'] },
          },
        ],
      }),
    ).toThrow(/Conflicting answers/);
  });

  it('keeps the opaque target and camera frame while changing context or hiding layers', async () => {
    const bytes = await readFile(
      new URL('../../public/models/ecorche.meshopt.glb', import.meta.url),
    );
    const model = await parseAnatomyModel(Uint8Array.from(bytes).buffer);
    const materials = createFocusMaterials();
    try {
      const target = previewTargets[0];
      const frame = targetFrame(model, target);
      const focus = planFocus(model, target, defaultAppearance, frame);
      const strict = planFocus(
        model,
        target,
        { ...defaultAppearance, mode: 'Strict Quiz' },
        frame,
      );
      const context = planFocus(
        model,
        target,
        { ...defaultAppearance, mode: 'Context' },
        frame,
      );
      const roles = (plan: typeof focus, role: string) =>
        [...plan.roles].filter(([, value]) => value === role);
      expect(roles(strict, 'target')).toEqual(roles(focus, 'target'));
      expect(roles(strict, 'dimmed')).toHaveLength(0);
      expect(roles(context, 'dimmed').length).toBeGreaterThan(
        roles(focus, 'dimmed').length,
      );
      expect(context.bounds).toBe(focus.bounds);
      const none = planFocus(
        model,
        target,
        { ...defaultAppearance, bones: false, muscles: false },
        frame,
      );
      expect(roles(none, 'context')).toHaveLength(0);
      expect(roles(none, 'dimmed')).toHaveLength(0);
      expect(roles(none, 'target')).toEqual(roles(focus, 'target'));
      const changed = planFocus(model, previewTargets[1]);
      expect(changed.roles.get(target.selectors[0].name)).not.toBe('target');

      materials.update('dark', 'red', { ...defaultAppearance, opacity: 0 });
      expect(materials.target.opacity).toBe(1);
      expect(materials.target.transparent).toBe(false);
      expect(materials.context.opacity).toBe(0);
      materials.update('light', 'blue', {
        ...defaultAppearance,
        opacity: 100,
        mode: 'Context',
      });
      expect(materials.target.opacity).toBe(1);
      expect(materials.context.opacity).toBeGreaterThan(0);
      expect(materials.context.opacity).toBeLessThan(1);
    } finally {
      materials.dispose();
      model.dispose();
    }
  });
});

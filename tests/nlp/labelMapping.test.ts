import { describe, it, expect } from 'vitest';
import {
  classifierTagToSignalKeys,
  classifierTagToDialogueAct,
  signalKeyToNarrow,
} from '../../services/nlp/labelMapping';

describe('labelMapping', () => {
  it('affection → affection signal key', () => {
    expect(classifierTagToSignalKeys.affection).toContain('affection');
  });

  it('control_pressure → control signal key', () => {
    expect(classifierTagToSignalKeys.control_pressure).toContain('control');
  });

  it('reality_denial → manipulationLike (gaslighting değil)', () => {
    const keys = classifierTagToSignalKeys.reality_denial;
    expect(keys).toContain('manipulationLike');
    // RelationshipSignalKey içinde "gaslighting" YOK; mapping yanlışlıkla onu döndürmüyor.
    expect(keys.join('|')).not.toMatch(/gaslighting/i);
  });

  it('plan_cancel → cancellation', () => {
    expect(classifierTagToSignalKeys.plan_cancel).toContain('cancellation');
  });

  it('warm_ack → DialogueAct: affection', () => {
    expect(classifierTagToDialogueAct.warm_ack).toBe('affection');
  });

  it('cold_ack → DialogueAct: short_ack', () => {
    expect(classifierTagToDialogueAct.cold_ack).toBe('short_ack');
  });

  it('control_pressure → DialogueAct: jealousy_check (kabaca)', () => {
    expect(classifierTagToDialogueAct.control_pressure).toBe('jealousy_check');
  });

  it('9-key narrow: affection → love', () => {
    expect(signalKeyToNarrow.affection).toBe('love');
  });

  it('9-key narrow: control → jealousy (en yakın)', () => {
    expect(signalKeyToNarrow.control).toBe('jealousy');
  });
});

import { describe, it, expect } from 'vitest';
import { computeNegationScope } from '../../services/nlp/negationScope';

describe('negationScope (clause-level)', () => {
  it('"sevmiyorum" — affection negated', () => {
    const n = computeNegationScope('seni sevmiyorum');
    expect(n.affectionNegated).toBe(true);
    expect(n.harshNegated).toBe(false);
  });

  it('"nefret etmiyorum" — harsh negated, affection değil', () => {
    const n = computeNegationScope('senden nefret etmiyorum');
    expect(n.harshNegated).toBe(true);
    expect(n.affectionNegated).toBe(false);
  });

  it('"salak değilsin" — harsh negated', () => {
    const n = computeNegationScope('salak değilsin');
    expect(n.harshNegated).toBe(true);
  });

  it('"kızmadım ama kırıldım" — harsh negated; clause-bazlı', () => {
    const n = computeNegationScope('kızmadım ama kırıldım.');
    expect(n.harshNegated).toBe(true);
    expect(n.negatedClauses).toBeGreaterThanOrEqual(1);
  });

  it('"gelemiyorum" — plan unavailable', () => {
    const n = computeNegationScope('yarın gelemiyorum.');
    expect(n.planUnavailable).toBe(true);
  });

  it('"istemiyorum artık" — refusal flag', () => {
    const n = computeNegationScope('böyle olmasını istemiyorum artık.');
    expect(n.refusalPresent).toBe(true);
  });

  it('hiç negation yoksa hepsi false', () => {
    const n = computeNegationScope('yarın hadi sinemaya gidelim');
    expect(n.affectionNegated).toBe(false);
    expect(n.harshNegated).toBe(false);
    expect(n.planUnavailable).toBe(false);
    expect(n.refusalPresent).toBe(false);
    expect(n.negatedClauses).toBe(0);
  });
});

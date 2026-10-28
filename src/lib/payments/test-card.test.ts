import { describe, expect, it } from 'vitest';

import { testCardScenario } from './test-card';

describe('testCardScenario', () => {
  it('карта успеха распознаётся с пробелами', () => {
    expect(testCardScenario('4242 4242 4242 4242')).toBe('success');
  });

  it('карта отказа распознаётся с дефисами', () => {
    expect(testCardScenario('4000-0000-0000-0002')).toBe('declined');
  });

  it('чужой номер не считается тестовым', () => {
    expect(testCardScenario('5555 5555 5555 4444')).toBeNull();
  });

  it('пустой ввод не считается тестовым', () => {
    expect(testCardScenario('')).toBeNull();
  });
});

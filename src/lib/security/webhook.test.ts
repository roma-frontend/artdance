import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  constantTimeEqualHex,
  signPayload,
  verifyBodySignature,
  verifyPayloadSignature,
  verifyTimestampedSignature,
} from './webhook';

const SECRET = 'whsec_test_secret_value_for_unit_tests';
const BODY = '{"transactionId":"tx_1","status":"PAID","amount":12000}';
const NOW = 1_800_000_000_000;

function signTimestamped(body: string, timestampSeconds: number, secret = SECRET): string {
  const v1 = createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex');
  return `t=${timestampSeconds},v1=${v1}`;
}

describe('verifyTimestampedSignature', () => {
  it('принимает корректную подпись внутри окна', () => {
    const header = signTimestamped(BODY, Math.floor(NOW / 1_000));
    const verdict = verifyTimestampedSignature(BODY, header, SECRET, NOW);
    expect(verdict.valid).toBe(true);
  });

  it('отклоняет устаревшее событие — защита от реплея', () => {
    const stale = Math.floor(NOW / 1_000) - 3_600;
    const verdict = verifyTimestampedSignature(BODY, signTimestamped(BODY, stale), SECRET, NOW);
    expect(verdict).toEqual({ valid: false, reason: 'STALE' });
  });

  it('отклоняет событие из будущего за пределами допуска', () => {
    const future = Math.floor(NOW / 1_000) + 3_600;
    const verdict = verifyTimestampedSignature(BODY, signTimestamped(BODY, future), SECRET, NOW);
    expect(verdict).toEqual({ valid: false, reason: 'STALE' });
  });

  it('отклоняет подмену тела при валидном времени', () => {
    const header = signTimestamped(BODY, Math.floor(NOW / 1_000));
    const tampered = BODY.replace('12000', '1');
    const verdict = verifyTimestampedSignature(tampered, header, SECRET, NOW);
    expect(verdict).toEqual({ valid: false, reason: 'MISMATCH' });
  });

  it('отклоняет подмену timestamp: время входит в подписываемую строку', () => {
    const timestamp = Math.floor(NOW / 1_000);
    const header = signTimestamped(BODY, timestamp);
    const shifted = header.replace(`t=${timestamp}`, `t=${timestamp - 10}`);
    const verdict = verifyTimestampedSignature(BODY, shifted, SECRET, NOW);
    expect(verdict).toEqual({ valid: false, reason: 'MISMATCH' });
  });

  it('отклоняет подпись, выпущенную другим секретом', () => {
    const header = signTimestamped(BODY, Math.floor(NOW / 1_000), 'another-secret');
    const verdict = verifyTimestampedSignature(BODY, header, SECRET, NOW);
    expect(verdict).toEqual({ valid: false, reason: 'MISMATCH' });
  });

  it('сообщает о некорректном формате заголовка', () => {
    expect(verifyTimestampedSignature(BODY, 'garbage', SECRET, NOW)).toEqual({
      valid: false,
      reason: 'MALFORMED_HEADER',
    });
  });

  it('не проходит без секрета — fail closed', () => {
    const header = signTimestamped(BODY, Math.floor(NOW / 1_000));
    expect(verifyTimestampedSignature(BODY, header, '', NOW)).toEqual({
      valid: false,
      reason: 'MISSING_INPUT',
    });
  });
});

describe('verifyBodySignature', () => {
  it('проверяет hex-подпись тела', () => {
    const signature = createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyBodySignature(BODY, signature, SECRET)).toBe(true);
    expect(verifyBodySignature(BODY.replace('PAID', 'FAILED'), signature, SECRET)).toBe(false);
  });

  it('проверяет base64-подпись тела', () => {
    const signature = createHmac('sha256', SECRET).update(BODY).digest('base64');
    expect(verifyBodySignature(BODY, signature, SECRET, 'base64')).toBe(true);
    expect(verifyBodySignature(BODY, 'AAAA', SECRET, 'base64')).toBe(false);
  });
});

describe('подписанные токены', () => {
  it('обратимы и чувствительны к секрету', () => {
    const signature = signPayload('invite:instructor_42', SECRET);
    expect(verifyPayloadSignature('invite:instructor_42', signature, SECRET)).toBe(true);
    expect(verifyPayloadSignature('invite:instructor_43', signature, SECRET)).toBe(false);
    expect(verifyPayloadSignature('invite:instructor_42', signature, 'rotated')).toBe(false);
  });
});

describe('constantTimeEqualHex', () => {
  it('не бросает на разной длине', () => {
    expect(constantTimeEqualHex('aabb', 'aa')).toBe(false);
  });

  it('не бросает на невалидном hex', () => {
    expect(constantTimeEqualHex('zzzz', 'aabb')).toBe(false);
  });
});

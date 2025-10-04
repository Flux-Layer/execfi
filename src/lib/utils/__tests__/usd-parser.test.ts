import { parseUSDInput, formatUSDValue, formatUSDCompact, isValidUSDAmount, formatUSDRange } from '../usd-parser';

describe('parseUSDInput', () => {
  it('parses basic USD amount', () => {
    expect(parseUSDInput('100')).toBe(100);
    expect(parseUSDInput('100.50')).toBe(100.50);
  });

  it('parses amount with dollar sign', () => {
    expect(parseUSDInput('$100')).toBe(100);
    expect(parseUSDInput('$1,234.56')).toBe(1234.56);
  });

  it('parses amount with USD suffix', () => {
    expect(parseUSDInput('100 USD')).toBe(100);
    expect(parseUSDInput('100USD')).toBe(100);
    expect(parseUSDInput('100 dollars')).toBe(100);
    expect(parseUSDInput('100 dollar')).toBe(100);
  });

  it('handles various formats', () => {
    expect(parseUSDInput('$1,234,567.89')).toBe(1234567.89);
    expect(parseUSDInput('  $100  ')).toBe(100);
    expect(parseUSDInput('0.99')).toBe(0.99);
  });

  it('throws on invalid input', () => {
    expect(() => parseUSDInput('abc')).toThrow();
    expect(() => parseUSDInput('')).toThrow();
    expect(() => parseUSDInput('$')).toThrow();
    expect(() => parseUSDInput('-100')).toThrow();
  });

  it('throws on negative amounts', () => {
    expect(() => parseUSDInput('-100')).toThrow('USD amount cannot be negative');
  });

  it('throws on non-finite amounts', () => {
    expect(() => parseUSDInput('Infinity')).toThrow('USD amount must be finite');
  });
});

describe('formatUSDValue', () => {
  it('formats with auto precision', () => {
    expect(formatUSDValue(0.000001, 'auto')).toBe('$0.000001');
    expect(formatUSDValue(0.99, 'auto')).toBe('$0.99');
    expect(formatUSDValue(12.34, 'auto')).toBe('$12.34');
    expect(formatUSDValue(1234, 'auto')).toBe('$1,234');
  });

  it('respects precision override', () => {
    const value = 123.456789;
    expect(formatUSDValue(value, 'low')).toContain('123.46');
    expect(formatUSDValue(value, 'medium')).toContain('123.4568');
    expect(formatUSDValue(value, 'high')).toContain('123.456789');
  });

  it('handles edge cases', () => {
    expect(formatUSDValue(0, 'auto')).toBe('$0.00');
    expect(formatUSDValue(Infinity, 'auto')).toBe('$0.00');
    expect(formatUSDValue(NaN, 'auto')).toBe('$0.00');
  });

  it('formats small amounts correctly', () => {
    expect(formatUSDValue(0.001, 'auto')).toBe('$0.0010');
    expect(formatUSDValue(0.5, 'auto')).toBe('$0.50');
  });

  it('formats large amounts correctly', () => {
    expect(formatUSDValue(1000, 'auto')).toBe('$1,000');
    expect(formatUSDValue(1234567.89, 'auto')).toBe('$1,234,568');
  });
});

describe('formatUSDCompact', () => {
  it('formats thousands', () => {
    const result1 = formatUSDCompact(1200);
    expect(result1).toContain('1.2');
    expect(result1).toContain('K');
    
    const result2 = formatUSDCompact(45000);
    expect(result2).toContain('45');
    expect(result2).toContain('K');
  });

  it('formats millions', () => {
    const result1 = formatUSDCompact(1200000);
    expect(result1).toContain('1.2');
    expect(result1).toContain('M');
    
    const result2 = formatUSDCompact(45000000);
    expect(result2).toContain('45');
    expect(result2).toContain('M');
  });

  it('formats billions', () => {
    const result = formatUSDCompact(1200000000);
    expect(result).toContain('1.2');
    expect(result).toContain('B');
  });

  it('keeps small amounts uncompacted', () => {
    expect(formatUSDCompact(123)).not.toContain('K');
    expect(formatUSDCompact(999)).not.toContain('K');
  });

  it('handles edge cases', () => {
    expect(formatUSDCompact(0)).toBe('$0.00');
    expect(formatUSDCompact(Infinity)).toBe('$0');
    expect(formatUSDCompact(NaN)).toBe('$0');
  });
});

describe('isValidUSDAmount', () => {
  it('validates correct amounts', () => {
    expect(isValidUSDAmount('100')).toBe(true);
    expect(isValidUSDAmount('$100')).toBe(true);
    expect(isValidUSDAmount('100.50')).toBe(true);
    expect(isValidUSDAmount('1,234.56')).toBe(true);
  });

  it('rejects invalid amounts', () => {
    expect(isValidUSDAmount('abc')).toBe(false);
    expect(isValidUSDAmount('-100')).toBe(false);
    expect(isValidUSDAmount('')).toBe(false);
    expect(isValidUSDAmount('$')).toBe(false);
  });
});

describe('formatUSDRange', () => {
  it('formats range correctly', () => {
    const range = formatUSDRange(10, 100);
    expect(range).toContain('$10');
    expect(range).toContain('$100');
    expect(range).toContain('-');
  });

  it('handles different precision values', () => {
    const range = formatUSDRange(0.001, 1000);
    expect(range).toContain('$0.0010');
    expect(range).toContain('$1,000');
  });
});

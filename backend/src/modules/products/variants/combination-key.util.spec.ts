import { buildCombinationKey } from './combination-key.util';

describe('buildCombinationKey', () => {
  const colorOption = 'a0000000-0000-0000-0000-000000000001';
  const sizeOption = 'b0000000-0000-0000-0000-000000000002';
  const red = 'c0000000-0000-0000-0000-000000000001';
  const medium = 'd0000000-0000-0000-0000-000000000002';

  it('produces the same key regardless of input order', () => {
    const keyA = buildCombinationKey([
      { optionId: colorOption, optionValueId: red },
      { optionId: sizeOption, optionValueId: medium },
    ]);
    const keyB = buildCombinationKey([
      { optionId: sizeOption, optionValueId: medium },
      { optionId: colorOption, optionValueId: red },
    ]);
    expect(keyA).toBe(keyB);
  });

  it('produces a different key for a different value', () => {
    const blue = 'c0000000-0000-0000-0000-000000000099';
    const keyRed = buildCombinationKey([
      { optionId: colorOption, optionValueId: red },
      { optionId: sizeOption, optionValueId: medium },
    ]);
    const keyBlue = buildCombinationKey([
      { optionId: colorOption, optionValueId: blue },
      { optionId: sizeOption, optionValueId: medium },
    ]);
    expect(keyRed).not.toBe(keyBlue);
  });

  it('produces a different key for a different number of options', () => {
    const keyOne = buildCombinationKey([
      { optionId: colorOption, optionValueId: red },
    ]);
    const keyTwo = buildCombinationKey([
      { optionId: colorOption, optionValueId: red },
      { optionId: sizeOption, optionValueId: medium },
    ]);
    expect(keyOne).not.toBe(keyTwo);
  });

  it('does not mutate the input array order', () => {
    const pairs = [
      { optionId: sizeOption, optionValueId: medium },
      { optionId: colorOption, optionValueId: red },
    ];
    const original = [...pairs];
    buildCombinationKey(pairs);
    expect(pairs).toEqual(original);
  });

  it('is deterministic across repeated calls', () => {
    const pairs = [
      { optionId: colorOption, optionValueId: red },
      { optionId: sizeOption, optionValueId: medium },
    ];
    expect(buildCombinationKey(pairs)).toBe(buildCombinationKey(pairs));
  });
});

import { VerificationTokensRepository } from './verification-tokens.repository';
import { VerificationTokenPurpose } from '../../common/enums/verification-token-purpose.enum';

describe('VerificationTokensRepository.consume', () => {
  function buildRepo(findOneResult: unknown) {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const findOne = jest.fn().mockResolvedValue(findOneResult);
    const typeormRepo = { findOne, update, create: jest.fn(), save: jest.fn() };
    const repo = new VerificationTokensRepository(typeormRepo as never);
    return { repo, findOne, update };
  }

  it('returns "invalid" when no token row matches the hash', async () => {
    const { repo } = buildRepo(null);
    const outcome = await repo.consume(
      'some-hash',
      VerificationTokenPurpose.EMAIL_VERIFICATION,
    );
    expect(outcome.kind).toBe('invalid');
  });

  it('returns "invalid" when the token was already consumed', async () => {
    const { repo } = buildRepo({
      id: 't1',
      userId: 'u1',
      purpose: VerificationTokenPurpose.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      user: { id: 'u1' },
    });
    const outcome = await repo.consume(
      'some-hash',
      VerificationTokenPurpose.EMAIL_VERIFICATION,
    );
    expect(outcome.kind).toBe('invalid');
  });

  it('returns "expired" when past expiresAt and does not mark consumed', async () => {
    const { repo, update } = buildRepo({
      id: 't1',
      userId: 'u1',
      purpose: VerificationTokenPurpose.PASSWORD_RESET,
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
      user: { id: 'u1' },
    });
    const outcome = await repo.consume(
      'some-hash',
      VerificationTokenPurpose.PASSWORD_RESET,
    );
    expect(outcome.kind).toBe('expired');
    expect(update).not.toHaveBeenCalled();
  });

  it('returns "invalid" when the token purpose does not match', async () => {
    const { repo } = buildRepo({
      id: 't1',
      userId: 'u1',
      purpose: VerificationTokenPurpose.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { id: 'u1' },
    });
    const outcome = await repo.consume(
      'some-hash',
      VerificationTokenPurpose.PASSWORD_RESET,
    );
    expect(outcome.kind).toBe('invalid');
  });

  it('returns "success" with the user and marks the token consumed exactly once', async () => {
    const user = { id: 'u1', email: 'a@example.com' };
    const { repo, update } = buildRepo({
      id: 't1',
      userId: 'u1',
      purpose: VerificationTokenPurpose.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user,
    });
    const outcome = await repo.consume(
      'some-hash',
      VerificationTokenPurpose.PASSWORD_RESET,
    );
    expect(outcome).toEqual({ kind: 'success', user });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      { id: 't1' },
      { consumedAt: expect.any(Date) as Date },
    );
  });
});

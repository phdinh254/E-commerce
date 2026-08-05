import { IsInt, IsString, Min } from 'class-validator';
import * as fsPromises from 'fs/promises';
import {
  readFromFile,
  SeedFileMalformedError,
  SeedFileNotFoundError,
  SeedPathTraversalError,
  SeedValidationError,
} from './read-from-file';

jest.mock('fs/promises');

const readFile = jest.mocked(fsPromises.readFile);

class SampleRecordDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  count: number;
}

describe('readFromFile', () => {
  beforeEach(() => {
    readFile.mockReset();
    // Snapshot cwd and change it mid-test to prove independence from cwd.
    jest.spyOn(process, 'cwd').mockReturnValue('/some/unrelated/directory');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads and validates a well-formed JSON array', async () => {
    readFile.mockResolvedValue(
      JSON.stringify([
        { name: 'a', count: 1 },
        { name: 'b', count: 2 },
      ]),
    );
    const result = await readFromFile('sample.json', SampleRecordDto);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(SampleRecordDto);
    expect(result[0].name).toBe('a');
  });

  it('does not depend on process.cwd()', async () => {
    readFile.mockResolvedValue(JSON.stringify([{ name: 'x', count: 0 }]));
    await readFromFile('sample.json', SampleRecordDto);
    const [calledPath] = readFile.mock.calls[0] as [string];
    expect(calledPath).not.toContain('unrelated');
    expect(calledPath).toContain('seeds');
  });

  it('throws SeedFileNotFoundError when the file does not exist', async () => {
    const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });
    readFile.mockRejectedValue(enoent);
    await expect(readFromFile('missing.json', SampleRecordDto)).rejects.toThrow(
      SeedFileNotFoundError,
    );
  });

  it('throws SeedFileMalformedError for invalid JSON syntax', async () => {
    readFile.mockResolvedValue('{ not valid json ');
    await expect(readFromFile('broken.json', SampleRecordDto)).rejects.toThrow(
      SeedFileMalformedError,
    );
  });

  it('throws SeedFileMalformedError when the top level is not an array', async () => {
    readFile.mockResolvedValue(JSON.stringify({ name: 'a' }));
    await expect(
      readFromFile('not-array.json', SampleRecordDto),
    ).rejects.toThrow(SeedFileMalformedError);
  });

  it('rejects relative path traversal ("../")', async () => {
    await expect(
      readFromFile('../../../etc/passwd', SampleRecordDto),
    ).rejects.toThrow(SeedPathTraversalError);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('rejects a POSIX absolute path', async () => {
    await expect(readFromFile('/etc/passwd', SampleRecordDto)).rejects.toThrow(
      SeedPathTraversalError,
    );
  });

  it('rejects a Windows drive-letter absolute path', async () => {
    await expect(
      readFromFile('C:\\Windows\\System32\\config', SampleRecordDto),
    ).rejects.toThrow(SeedPathTraversalError);
  });

  it('throws SeedValidationError when a record fails schema validation, naming the file', async () => {
    readFile.mockResolvedValue(JSON.stringify([{ name: 'a', count: -1 }]));
    await expect(readFromFile('invalid.json', SampleRecordDto)).rejects.toThrow(
      SeedValidationError,
    );
    await expect(readFromFile('invalid.json', SampleRecordDto)).rejects.toThrow(
      /invalid\.json/,
    );
  });

  it('rejects unknown/extra fields not declared on the DTO (whitelist)', async () => {
    readFile.mockResolvedValue(
      JSON.stringify([{ name: 'a', count: 1, extra: 'nope' }]),
    );
    await expect(
      readFromFile('extra-field.json', SampleRecordDto),
    ).rejects.toThrow(SeedValidationError);
  });
});

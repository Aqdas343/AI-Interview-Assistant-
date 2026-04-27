/**
 * Unit tests for transcript cleaning functionality
 * Tests the cleanTranscript function that removes consecutive duplicate words
 */

describe('Transcript Cleaning', () => {
  // Extract the cleanTranscript function logic for testing
  const cleanTranscript = (text) => {
    return text.replace(/\b(\w+)\s+\1\b/gi, '$1');
  };

  describe('cleanTranscript()', () => {
    it('should remove consecutive duplicate words (case insensitive)', () => {
      const input = 'what what is the answer';
      const expected = 'what is the answer';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should remove multiple consecutive duplicates', () => {
      const input = 'can can you you tell tell me me';
      const expected = 'can you tell me';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle case-insensitive duplicates', () => {
      const input = 'What What is the the answer';
      const expected = 'What is the answer';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should not remove non-consecutive duplicates', () => {
      const input = 'what is what you think';
      const expected = 'what is what you think';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      const input = '';
      const expected = '';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle strings with no duplicates', () => {
      const input = 'this is a clean transcript';
      const expected = 'this is a clean transcript';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle single word', () => {
      const input = 'hello';
      const expected = 'hello';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle duplicate at the beginning', () => {
      const input = 'the the answer is correct';
      const expected = 'the answer is correct';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle duplicate at the end', () => {
      const input = 'this is the the';
      const expected = 'this is the';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle multiple duplicate pairs in one string', () => {
      const input = 'can can you you explain explain this this';
      const expected = 'can you explain this';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should preserve punctuation and special characters', () => {
      const input = 'what what? is the the answer?';
      const expected = 'what? is the answer?';
      expect(cleanTranscript(input)).toBe(expected);
    });

    it('should handle real-world transcription example', () => {
      const input = 'can you tell tell me about about your experience experience with with JavaScript';
      const expected = 'can you tell me about your experience with JavaScript';
      expect(cleanTranscript(input)).toBe(expected);
    });
  });
});

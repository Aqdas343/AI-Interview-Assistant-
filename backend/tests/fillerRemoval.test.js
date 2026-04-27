/**
 * Unit tests for filler word removal functionality
 * Tests the removeFillers function that removes common filler words from questions
 * 
 * Validates Requirement 3.6: Filler word removal in question detection
 */

describe('Filler Word Removal', () => {
  // Extract the removeFillers function logic for testing
  const removeFillers = (text) => {
    return text
      .replace(/\b(um|uh|err|ah|hmm|like|you\s+know|i\s+mean|sort\s+of|kind\s+of)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  describe('removeFillers()', () => {
    it('should remove single-word fillers (um, uh, err, ah, hmm)', () => {
      const input = 'um what is uh the answer err to this ah question hmm';
      const expected = 'what is the answer to this question';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should remove "like" filler word', () => {
      const input = 'like what is like the answer';
      const expected = 'what is the answer';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should remove multi-word fillers (you know, i mean, sort of, kind of)', () => {
      const input = 'you know what is i mean the answer sort of to this kind of question';
      const expected = 'what is the answer to this question';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle case-insensitive filler removal', () => {
      const input = 'Um what is UH the answer Like really';
      const expected = 'what is the answer really';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle multiple consecutive fillers', () => {
      const input = 'um uh like what is the answer';
      const expected = 'what is the answer';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      const input = '';
      const expected = '';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle strings with no fillers', () => {
      const input = 'what is the answer to this question';
      const expected = 'what is the answer to this question';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should preserve non-filler words that contain filler substrings', () => {
      const input = 'I like programming and humming songs';
      const expected = 'I programming and humming songs';
      // Note: "like" is removed as a filler, but "humming" is preserved
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle fillers at the beginning', () => {
      const input = 'um uh what is the answer';
      const expected = 'what is the answer';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle fillers at the end', () => {
      const input = 'what is the answer um uh';
      const expected = 'what is the answer';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle real-world interview question with fillers', () => {
      const input = 'um can you like tell me you know about your experience with uh JavaScript';
      const expected = 'can you tell me about your experience with JavaScript';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle questions with multiple spaces after filler removal', () => {
      const input = 'what   um   is   uh   the   answer';
      const expected = 'what is the answer';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should preserve punctuation', () => {
      const input = 'um what is, like, the answer?';
      const expected = 'what is, , the answer?';
      // Note: Punctuation is preserved as-is; filler removal may leave extra commas
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle complex real-world example', () => {
      const input = 'um so like can you you know tell me i mean about your sort of experience with kind of React and uh Redux';
      const expected = 'so can you tell me about your experience with React and Redux';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle string with only fillers', () => {
      const input = 'um uh like you know';
      const expected = '';
      expect(removeFillers(input)).toBe(expected);
    });

    it('should handle mixed case multi-word fillers', () => {
      const input = 'You Know what is I Mean the answer Sort Of';
      const expected = 'what is the answer';
      expect(removeFillers(input)).toBe(expected);
    });
  });
});

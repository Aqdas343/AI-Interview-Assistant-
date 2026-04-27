# Implementation Plan: Desktop Mini Real-Time Interview Assistant

## Overview

This implementation plan breaks down the Desktop Mini Real-Time Interview Assistant feature into discrete, testable coding tasks. The feature provides continuous audio monitoring, real-time transcription, question detection, and AI-powered answer generation through a compact Electron-based desktop application.

The implementation follows a layered approach:
1. **Foundation**: Socket event infrastructure and state management
2. **Core Features**: Audio capture, transcription display, and streaming answers
3. **Intelligence**: Question detection and conversation memory
4. **Polish**: Error handling, UI refinements, and performance optimization

Each task builds incrementally on previous work, with checkpoints to validate functionality before proceeding.

## Tasks

- [ ] 1. Enhance backend socket event handlers
  - [x] 1.1 Add missing socket event listeners in socketHandler.js
    - Verify all required events are registered: `answer_start`, `answer_chunk`, `answer_end`, `answer_error`
    - Ensure `live_transcript_chunk` event emits both `text` and `buffer` fields
    - Add `answer_complete` event emission (currently missing, frontend expects it)
    - _Requirements: 6.5, 6.6, 6.7, 6.8_

  - [x] 1.2 Implement transcript buffer cleaning and deduplication
    - Add `cleanTranscript()` function call before emitting `live_transcript_chunk`
    - Ensure consecutive duplicate words are removed from transcript text
    - _Requirements: 2.6_

  - [x] 1.3 Add filler word removal in question detection
    - Apply `removeFillers()` function to question text before emitting `answer_start`
    - Ensure filler words (um, uh, like, you know) are stripped from displayed questions
    - _Requirements: 3.6_

  - [ ]* 1.4 Write unit tests for socket event handlers
    - Test that all events emit with correct payload structure
    - Test transcript cleaning removes duplicates correctly
    - Test filler word removal from questions
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 2.6, 3.6_

- [ ] 2. Implement frontend socket event listeners
  - [x] 2.1 Add socket event listeners in DesktopMini.jsx
    - Register listener for `answer_start` event to display detected question
    - Register listener for `answer_end` event to finalize answer display
    - Register listener for `answer_error` event to show error messages
    - Update existing `answer_chunk` handler to reset state when `networkCompleteRef` is true
    - _Requirements: 6.9, 3.5, 4.6, 8.8_

  - [x] 2.2 Implement conversation history state management
    - Add `conversationHistory` state array to store question-answer pairs
    - Update state when `answer_start` received (add question entry)
    - Update state when `answer_end` received (add answer entry)
    - Limit history to most recent 12 messages (6 Q&A pairs)
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ] 2.3 Create conversation history UI component
    - Display conversation history in scrollable container
    - Style questions and answers with distinct visual appearance (user vs assistant bubbles)
    - Auto-scroll to newest message when new entry added
    - Show placeholder "Listening for questions..." when history is empty
    - _Requirements: 5.3, 5.4, 5.7_

  - [ ]* 2.4 Write integration tests for socket event flow
    - Test that `answer_start` adds question to conversation history
    - Test that `answer_chunk` updates streaming answer display
    - Test that `answer_end` finalizes answer and adds to history
    - Test that `answer_error` displays error message
    - _Requirements: 6.9, 3.5, 4.6, 8.8_

- [ ] 3. Checkpoint - Verify socket communication and conversation display
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Enhance audio capture error handling
  - [ ] 4.1 Improve error messages in startRecording()
    - Add specific error message display for each error type (NotAllowedError, NotFoundError, NotReadableError, OverconstrainedError)
    - Implement UI component to display error messages with instructions
    - Add check for secure context (HTTPS or localhost) before attempting audio capture
    - Add check for mediaDevices API support
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 4.2 Implement retry logic for OverconstrainedError
    - Add fallback to basic audio constraints when advanced constraints fail
    - Log retry attempts and outcomes
    - _Requirements: 1.6, 9.9_

  - [ ]* 4.3 Write unit tests for audio error handling
    - Mock getUserMedia to throw each error type
    - Verify correct error message displayed for each case
    - Test retry logic for OverconstrainedError
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.9_

- [ ] 5. Implement visual feedback and UI states
  - [ ] 5.1 Add recording status indicators
    - Display pulsing red microphone icon when recording is active
    - Display muted microphone icon when recording is inactive
    - Add "Active Listening" / "Processing Paused" status text
    - _Requirements: 8.1, 8.2, 8.7_

  - [ ] 5.2 Add streaming cursor indicator
    - Display blinking cursor at end of answer text while streaming
    - Remove cursor when streaming completes
    - _Requirements: 4.7, 8.3_

  - [ ] 5.3 Implement live transcript ticker in collapsed mode
    - Display scrolling ticker of live transcript in toolbar when collapsed
    - Limit ticker text to most recent 150 characters
    - Add subtle animation/pulse effect
    - _Requirements: 8.5_

  - [ ]* 5.4 Write UI component tests
    - Test microphone icon changes based on recording state
    - Test cursor appears/disappears during streaming
    - Test live transcript ticker displays in collapsed mode
    - _Requirements: 8.1, 8.2, 8.7, 4.7, 8.3, 8.5_

- [ ] 6. Implement session context and memory
  - [ ] 6.1 Add conversation memory to socket handler state
    - Verify `memory` array is properly initialized in session state
    - Ensure memory is updated after each question-answer pair
    - Implement memory limit (12 messages = 6 Q&A pairs)
    - Remove oldest pair when limit exceeded
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 6.2 Pass conversation memory to AI answer generation
    - Include `state.memory` in options when calling `generateLiveAnswerStream()`
    - Verify memory is included in AI prompt context
    - _Requirements: 10.4_

  - [ ] 6.3 Implement topic keyword tracking
    - Verify `extractTopicKeywords()` function extracts keywords from questions
    - Update `topicHistory` array after each question
    - Limit topic history to 20 keywords
    - Pass topic history to AI answer generation
    - _Requirements: 10.5, 10.6_

  - [ ]* 6.4 Write unit tests for memory management
    - Test memory array maintains correct size (max 12 messages)
    - Test oldest messages removed when limit exceeded
    - Test topic keywords extracted correctly
    - Test topic history maintains max 20 keywords
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_

- [ ] 7. Checkpoint - Verify memory and context features
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement authentication integration
  - [ ] 8.1 Add authentication check in DesktopMini.jsx
    - Use `useAuthStore` to check if user is authenticated
    - Display login prompt when not authenticated
    - Display full assistant interface when authenticated
    - _Requirements: 12.1, 12.2, 12.4_

  - [ ] 8.2 Add "Sign in via Browser" functionality
    - Implement `openExternal()` function to open login page in default browser
    - Add button to trigger browser login
    - _Requirements: 12.3_

  - [ ] 8.3 Include userId in socket events
    - Pass `user?.id` from auth store in `join_session` event
    - Pass `user?.id` from auth store in `audio-chunk` events
    - _Requirements: 12.5, 12.6_

  - [ ]* 8.4 Write integration tests for authentication flow
    - Test login prompt displays when not authenticated
    - Test assistant interface displays when authenticated
    - Test userId included in socket events
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.6_

- [ ] 9. Optimize streaming engine performance
  - [ ] 9.1 Refine typing animation algorithm
    - Verify adaptive chunk sizing in `startTyping()` function
    - Ensure typing interval is set to 15ms for smooth animation
    - Add cleanup logic to prevent memory leaks from intervals
    - _Requirements: 4.4_

  - [ ] 9.2 Implement race condition prevention
    - Verify `networkCompleteRef` is checked before starting typing animation
    - Ensure `rawAnswerRef` is reset when new answer starts
    - Add proper cleanup in component unmount
    - _Requirements: 7.5, 7.6, 7.7_

  - [ ]* 9.3 Write performance tests for streaming engine
    - Test typing animation displays at correct rate
    - Test adaptive chunk sizing increases speed when behind
    - Test cleanup prevents memory leaks
    - _Requirements: 4.4, 7.5, 7.6, 7.7_

- [ ] 10. Implement buffer retention and cleanup
  - [ ] 10.1 Add transcript buffer retention logic
    - Implement buffer retention after question processing (keep last 100 chars)
    - Find last punctuation mark and trim buffer accordingly
    - Ensure buffer doesn't grow unbounded
    - _Requirements: 11.6_

  - [ ] 10.2 Add session cleanup on disconnect
    - Clear conversation history when socket disconnects
    - Clear session state from memory
    - Log session metrics before cleanup
    - _Requirements: 5.6, 10.7, 11.7_

  - [ ]* 10.3 Write unit tests for buffer management
    - Test buffer retention keeps last 100 characters
    - Test buffer cleanup after question processing
    - Test session state cleared on disconnect
    - _Requirements: 11.6, 5.6, 10.7_

- [ ] 11. Add error handling for AI services
  - [ ] 11.1 Implement transcription error handling
    - Add try-catch around `transcribeAudio()` call
    - Log transcription errors without blocking subsequent chunks
    - Continue processing even if single transcription fails
    - _Requirements: 9.6_

  - [ ] 11.2 Implement answer generation error handling
    - Add try-catch around `generateLiveAnswerStream()` call
    - Emit `answer_error` event when generation fails
    - Log error details for debugging
    - _Requirements: 9.7_

  - [ ] 11.3 Add frontend error display
    - Handle `answer_error` event in DesktopMini.jsx
    - Display error message in chat interface
    - Provide user-friendly error text
    - _Requirements: 9.8_

  - [ ]* 11.4 Write integration tests for error handling
    - Mock transcription service failure
    - Mock answer generation failure
    - Verify error messages displayed correctly
    - Verify system continues processing after errors
    - _Requirements: 9.6, 9.7, 9.8_

- [ ] 12. Checkpoint - Verify error handling and cleanup
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement window resize and Electron IPC
  - [ ] 13.1 Add window resize logic
    - Implement `sendResize()` function to communicate with Electron main process
    - Calculate correct height based on expanded state and authentication status
    - Trigger resize when `isExpanded` or `isAuthenticated` changes
    - _Requirements: 8.6_

  - [ ] 13.2 Add Electron IPC handlers in main process
    - Add `resize-window` IPC handler to resize window
    - Add `close-mini` IPC handler to close window
    - Ensure handlers are properly registered
    - _Requirements: 8.6_

  - [ ]* 13.3 Write integration tests for Electron IPC
    - Test window resizes correctly when expanded/collapsed
    - Test window closes when close button clicked
    - Test height adjusts based on authentication state
    - _Requirements: 8.6_

- [ ] 14. Polish UI and add final touches
  - [ ] 14.1 Remove unused imports
    - Remove unused imports: `React`, `Sparkles`, `StopCircle`, `Play`
    - Clean up any other unused variables or imports
    - _Requirements: General code quality_

  - [ ] 14.2 Add missing Lock icon import
    - Import `Lock` icon from lucide-react for authentication prompt
    - Verify icon displays correctly in login prompt
    - _Requirements: 12.2_

  - [ ] 14.3 Implement tab switching UI (placeholder)
    - Add click handlers for "Assist", "Transcript", "Recap" tabs
    - Add state to track active tab
    - Display appropriate content based on active tab
    - _Requirements: 8.6_

  - [ ]* 14.4 Write UI polish tests
    - Test tab switching changes active tab
    - Test all icons display correctly
    - Test no console errors from unused imports
    - _Requirements: 8.6_

- [ ] 15. Final checkpoint - End-to-end testing
  - [ ] 15.1 Test complete audio capture flow
    - Start recording → capture audio → emit chunks → verify backend receives
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 15.2 Test complete transcription flow
    - Audio chunk → transcription → live_transcript_chunk event → UI update
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 15.3 Test complete question detection flow
    - Transcript buffer → question detection → answer_start event → question display
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 15.4 Test complete answer streaming flow
    - Question detected → answer generation → answer_chunk events → typing animation → answer_end event → conversation history update
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 15.5 Test conversation history and memory
    - Multiple Q&A pairs → conversation history display → memory limit enforcement → context in AI responses
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.3, 10.4_

  - [ ] 15.6 Test error handling scenarios
    - Microphone permission denied → error message
    - Transcription failure → continue processing
    - Answer generation failure → error message display
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ] 15.7 Test authentication flow
    - Not authenticated → login prompt → sign in via browser
    - Authenticated → full interface → userId in socket events
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical breakpoints
- The implementation assumes existing infrastructure (Socket.IO, AI services, auth store) is already functional
- Focus is on wiring together existing components and adding missing event handlers
- All code examples should use JavaScript/React for frontend and Node.js for backend
- Property-based tests are not included as this feature focuses on integration and UI behavior rather than universal correctness properties

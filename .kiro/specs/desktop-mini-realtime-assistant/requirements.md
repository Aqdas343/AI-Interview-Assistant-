# Requirements Document

## Introduction

The Desktop Mini Real-Time Interview Assistant is a compact, always-on-top desktop application that provides live interview assistance through continuous audio monitoring, real-time transcription, question detection, and AI-powered answer generation. The application operates as a mini chatbot interface that maintains conversation history and provides contextual responses throughout an interview session.

## Glossary

- **Desktop_Mini_App**: The Electron-based desktop application component that provides the user interface
- **Audio_Capture_System**: The browser-based MediaRecorder API system that captures microphone audio
- **Transcription_Service**: The Deepgram or OpenAI Whisper service that converts audio to text
- **Question_Detector**: The AI service component that identifies when a complete question has been asked
- **Answer_Generator**: The AI service (Gemini/OpenAI) that generates contextual responses to detected questions
- **Socket_Handler**: The backend WebSocket event handler that manages real-time communication
- **Conversation_History**: The persistent record of question-answer pairs within a session
- **Chat_Interface**: The UI component that displays conversation history in a scrollable format
- **Session_State**: The in-memory state object that tracks transcription buffer, processing status, and conversation context
- **Streaming_Engine**: The component that delivers AI-generated answers incrementally with typing effect
- **Frontend_Socket_Client**: The React-based Socket.IO client that emits and receives real-time events
- **Backend_Socket_Server**: The Node.js Socket.IO server that processes audio and coordinates AI services

## Requirements

### Requirement 1: Continuous Audio Capture

**User Story:** As an interview candidate, I want the application to automatically start listening to my microphone when launched, so that I don't have to manually start recording for each question.

#### Acceptance Criteria

1. WHEN the Desktop_Mini_App is launched, THE Audio_Capture_System SHALL automatically request microphone permissions
2. WHEN microphone permissions are granted, THE Audio_Capture_System SHALL immediately begin capturing audio without user interaction
3. WHILE the Desktop_Mini_App is running, THE Audio_Capture_System SHALL continuously stream audio chunks every 3 seconds to the Backend_Socket_Server
4. IF microphone permissions are denied, THEN THE Desktop_Mini_App SHALL display a clear error message with instructions to enable permissions
5. IF no microphone device is found, THEN THE Desktop_Mini_App SHALL display an error message indicating no audio input device is available
6. WHEN audio capture encounters an error, THE Audio_Capture_System SHALL attempt to restart with basic audio settings before failing permanently

### Requirement 2: Real-Time Audio Transcription

**User Story:** As an interview candidate, I want to see my spoken words transcribed in real-time, so that I can verify the system is correctly capturing the interviewer's questions.

#### Acceptance Criteria

1. WHEN an audio chunk is received, THE Transcription_Service SHALL transcribe it to text within 200 milliseconds
2. WHEN transcription text is generated, THE Backend_Socket_Server SHALL emit a `live_transcript_chunk` event containing the transcribed text
3. WHEN the Frontend_Socket_Client receives a `live_transcript_chunk` event, THE Chat_Interface SHALL display the transcribed text immediately
4. THE Session_State SHALL maintain a rolling transcript buffer of the most recent 150 characters
5. WHILE audio is being captured, THE Chat_Interface SHALL display the live transcript with a visual indicator showing active listening
6. WHEN transcription contains duplicate words, THE Backend_Socket_Server SHALL clean the transcript by removing consecutive duplicates before emitting

### Requirement 3: Question Detection and Display

**User Story:** As an interview candidate, I want the system to detect when a complete question has been asked and display it clearly, so that I can see what question the AI is answering.

#### Acceptance Criteria

1. WHEN the transcript buffer contains a question mark, THE Question_Detector SHALL immediately trigger question processing
2. WHEN the transcript buffer shows 400ms of silence AND contains question intent markers, THE Question_Detector SHALL trigger early question processing
3. WHEN the transcript buffer shows 800ms of silence AND exceeds 40 characters, THE Question_Detector SHALL use AI classification to detect if a complete question exists
4. WHEN a question is detected, THE Backend_Socket_Server SHALL emit an `answer_start` event containing the detected question text
5. WHEN the Frontend_Socket_Client receives an `answer_start` event, THE Chat_Interface SHALL display the question text in a distinct visual style (e.g., user message bubble)
6. THE Question_Detector SHALL remove filler words (um, uh, like, you know) from the question text before displaying
7. THE Question_Detector SHALL prevent duplicate question processing by comparing normalized question text against the last processed question

### Requirement 4: AI Answer Generation and Streaming

**User Story:** As an interview candidate, I want to receive AI-generated answers that stream in with a typing effect, so that I can start reading the response immediately while it's being generated.

#### Acceptance Criteria

1. WHEN a question is detected, THE Answer_Generator SHALL begin generating a response within 500 milliseconds
2. WHILE the answer is being generated, THE Answer_Generator SHALL emit `answer_chunk` events containing incremental text fragments
3. WHEN the Frontend_Socket_Client receives an `answer_chunk` event, THE Streaming_Engine SHALL append the chunk to the displayed answer with a typing animation effect
4. THE Streaming_Engine SHALL display answer text at a rate of 15 milliseconds per character batch to simulate natural typing
5. WHEN answer generation is complete, THE Backend_Socket_Server SHALL emit an `answer_end` event containing the full answer and metadata
6. WHEN the Frontend_Socket_Client receives an `answer_end` event, THE Streaming_Engine SHALL complete any remaining typing animation and mark the answer as complete
7. WHILE an answer is streaming, THE Chat_Interface SHALL display a blinking cursor indicator at the end of the current text

### Requirement 5: Conversation History Management

**User Story:** As an interview candidate, I want to see a scrollable history of all questions and answers in the current session, so that I can review previous exchanges and maintain context.

#### Acceptance Criteria

1. WHEN a question is detected and displayed, THE Conversation_History SHALL store the question as a new entry with timestamp and role "user"
2. WHEN an answer is completed, THE Conversation_History SHALL store the answer as a new entry with timestamp and role "assistant"
3. THE Chat_Interface SHALL display conversation history entries in chronological order with alternating visual styles for questions and answers
4. THE Chat_Interface SHALL provide a scrollable container that automatically scrolls to the newest message when a new entry is added
5. THE Session_State SHALL maintain the most recent 6 question-answer pairs (12 total messages) in memory for context
6. WHEN the session ends, THE Conversation_History SHALL be cleared from memory
7. THE Chat_Interface SHALL display a placeholder message "Listening for questions..." when no conversation history exists

### Requirement 6: Socket Event Handling

**User Story:** As a developer, I want reliable socket event communication between frontend and backend, so that audio, transcription, and answers flow correctly through the system.

#### Acceptance Criteria

1. WHEN the Desktop_Mini_App initializes, THE Frontend_Socket_Client SHALL establish a WebSocket connection to the Backend_Socket_Server
2. WHEN the connection is established, THE Frontend_Socket_Client SHALL emit a `join_session` event with sessionId and userId
3. WHEN an audio chunk is captured, THE Frontend_Socket_Client SHALL emit an `audio-chunk` event containing the audio buffer, sessionId, and userId
4. THE Backend_Socket_Handler SHALL listen for `audio-chunk` events and process them through the Transcription_Service
5. THE Backend_Socket_Handler SHALL emit `live_transcript_chunk` events for each transcription result
6. THE Backend_Socket_Handler SHALL emit `answer_start` events when question detection triggers
7. THE Backend_Socket_Handler SHALL emit `answer_chunk` events for each streaming fragment during answer generation
8. THE Backend_Socket_Handler SHALL emit `answer_end` events when answer generation completes
9. THE Frontend_Socket_Client SHALL register listeners for all backend events: `live_transcript_chunk`, `answer_start`, `answer_chunk`, `answer_end`, `answer_error`
10. IF a socket connection is lost, THE Frontend_Socket_Client SHALL attempt to reconnect automatically

### Requirement 7: State Management

**User Story:** As a developer, I want proper state management for questions, answers, and UI state, so that the application behaves predictably and avoids race conditions.

#### Acceptance Criteria

1. THE Desktop_Mini_App SHALL maintain local React state for: isExpanded, isRecording, liveTranscript, liveAnswer, and conversation history
2. WHEN a new answer begins streaming, THE Desktop_Mini_App SHALL reset the answer state and set isStreaming to true
3. WHEN answer streaming completes, THE Desktop_Mini_App SHALL set isStreaming to false
4. THE Desktop_Mini_App SHALL use refs for: rawAnswerRef (network buffer), networkCompleteRef (completion flag), typingIntervalRef (animation timer), mediaRecorderRef (audio recorder), socketRef (socket instance)
5. WHEN a new `answer_chunk` arrives and networkCompleteRef is true, THE Desktop_Mini_App SHALL reset the answer state before appending the chunk
6. THE Desktop_Mini_App SHALL prevent race conditions by checking networkCompleteRef before starting typing animations
7. WHEN the component unmounts, THE Desktop_Mini_App SHALL clean up all intervals, stop recording, and remove socket listeners

### Requirement 8: Visual Feedback and UI States

**User Story:** As an interview candidate, I want clear visual feedback about the system's current state, so that I know when it's listening, processing, or ready for the next question.

#### Acceptance Criteria

1. WHEN the microphone is actively recording, THE Chat_Interface SHALL display a pulsing red microphone icon
2. WHEN the microphone is not recording, THE Chat_Interface SHALL display a muted microphone icon
3. WHILE an answer is streaming, THE Chat_Interface SHALL display a blinking cursor at the end of the answer text
4. WHEN no question has been detected yet, THE Chat_Interface SHALL display "Listening for questions..." with the current live transcript preview
5. WHEN the Desktop_Mini_App is collapsed, THE Chat_Interface SHALL display a scrolling ticker of the live transcript in the toolbar
6. WHEN the Desktop_Mini_App is expanded, THE Chat_Interface SHALL show the full conversation history panel
7. THE Chat_Interface SHALL display a status indicator showing "Active Listening" when recording is enabled and "Processing Paused" when recording is disabled

### Requirement 9: Error Handling and Edge Cases

**User Story:** As an interview candidate, I want the system to handle errors gracefully and provide helpful feedback, so that I can troubleshoot issues without losing my interview flow.

#### Acceptance Criteria

1. IF microphone access is denied, THEN THE Desktop_Mini_App SHALL display an error message: "Microphone access denied by user" with instructions to enable permissions
2. IF no microphone is found, THEN THE Desktop_Mini_App SHALL display an error message: "No microphone found" with instructions to connect an audio input device
3. IF the microphone is already in use, THEN THE Desktop_Mini_App SHALL display an error message: "Microphone is already in use by another application"
4. IF the browser does not support audio recording, THEN THE Desktop_Mini_App SHALL display an error message: "Browser does not support audio recording"
5. IF the connection is not secure (not HTTPS or localhost), THEN THE Desktop_Mini_App SHALL display an error message: "Microphone access requires HTTPS"
6. IF transcription fails, THEN THE Backend_Socket_Server SHALL log the error and continue processing subsequent audio chunks
7. IF answer generation fails, THEN THE Backend_Socket_Server SHALL emit an `answer_error` event with message "AI failed to generate a response"
8. WHEN the Frontend_Socket_Client receives an `answer_error` event, THE Chat_Interface SHALL display the error message to the user
9. IF audio constraints are over-constrained, THEN THE Audio_Capture_System SHALL retry with basic audio settings before failing

### Requirement 10: Session Context and Memory

**User Story:** As an interview candidate, I want the AI to remember previous questions and answers in the session, so that responses are contextually aware and build on earlier conversation.

#### Acceptance Criteria

1. WHEN a question-answer pair is completed, THE Session_State SHALL append both messages to the conversation memory array
2. THE Session_State SHALL maintain a maximum of 12 messages (6 question-answer pairs) in the memory array
3. WHEN the memory array exceeds 12 messages, THE Session_State SHALL remove the oldest 2 messages (1 question-answer pair)
4. WHEN generating a new answer, THE Answer_Generator SHALL include the conversation memory in the AI prompt context
5. THE Session_State SHALL track topic keywords from each question and maintain a history of the last 20 keywords
6. WHEN generating a new answer, THE Answer_Generator SHALL include the topic history to improve contextual relevance
7. WHEN the socket disconnects, THE Session_State SHALL be cleared from memory

### Requirement 11: Performance and Rate Limiting

**User Story:** As a system administrator, I want the application to implement rate limiting and performance optimizations, so that it doesn't overwhelm the AI services or create excessive costs.

#### Acceptance Criteria

1. THE Backend_Socket_Handler SHALL enforce a minimum gap of 2000 milliseconds between consecutive question triggers
2. THE Backend_Socket_Handler SHALL enforce a maximum of 15 question triggers per minute per session
3. WHEN rate limits are exceeded, THE Backend_Socket_Handler SHALL suppress the trigger and increment a suppression counter
4. THE Backend_Socket_Handler SHALL track performance metrics including: total triggers, cancellation rate, early trigger rate, predictive accuracy, and average time-to-first-token
5. WHEN a new question is detected while an answer is still streaming, THE Backend_Socket_Handler SHALL cancel the previous stream and start the new one
6. THE Backend_Socket_Handler SHALL retain only the last 100 characters of the transcript buffer after each question to prevent unbounded memory growth
7. WHEN the socket disconnects, THE Backend_Socket_Handler SHALL log a session report with all performance metrics

### Requirement 12: Authentication and Authorization

**User Story:** As an interview candidate, I want to be able to use the Desktop Mini app with my authenticated account, so that my responses are personalized to my profile.

#### Acceptance Criteria

1. WHEN the Desktop_Mini_App launches, THE Desktop_Mini_App SHALL check if the user is authenticated via the auth store
2. IF the user is not authenticated, THEN THE Chat_Interface SHALL display a login prompt with a button to "Sign in via Browser"
3. WHEN the user clicks "Sign in via Browser", THE Desktop_Mini_App SHALL open the login page in the default web browser
4. WHEN the user is authenticated, THE Chat_Interface SHALL display the full assistant interface with conversation history
5. WHEN joining a session, THE Frontend_Socket_Client SHALL include the userId from the auth store in the `join_session` event
6. WHEN emitting audio chunks, THE Frontend_Socket_Client SHALL include the userId from the auth store in the `audio-chunk` event
7. THE Backend_Socket_Handler SHALL use the userId to personalize AI responses based on the candidate's profile

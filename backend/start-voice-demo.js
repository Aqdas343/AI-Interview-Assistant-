const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

console.log('🎤 Starting Voice Demo (No API calls needed)...');

// Create Express app
const app = express();
const server = http.createServer(app);

// Setup CORS
app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Voice Demo Backend is running',
    timestamp: new Date().toISOString(),
    mode: 'demo'
  });
});

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Simple demo responses
const demoResponses = {
  "what is react": "React is a JavaScript library for building user interfaces. It was created by Facebook and allows you to create reusable UI components. React uses a virtual DOM for efficient updates and follows a component-based architecture.",
  "what is javascript": "JavaScript is a programming language that runs in web browsers and on servers. It's used to make websites interactive and dynamic. JavaScript supports object-oriented, functional, and procedural programming styles.",
  "what is node": "Node.js is a JavaScript runtime built on Chrome's V8 engine. It allows you to run JavaScript on the server side, making it possible to build full-stack applications using just JavaScript.",
  "what is python": "Python is a high-level programming language known for its simplicity and readability. It's widely used for web development, data science, artificial intelligence, and automation.",
  "hello": "Hello! I'm your AI voice assistant. You can ask me questions about programming, technology, or anything else you'd like to know!",
  "default": "That's an interesting question! I can help you with programming concepts, web development, JavaScript, React, Node.js, and many other technical topics. What would you like to learn about?"
};

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('join_session', (data) => {
    const { sessionId, userId } = data;
    socket.join(sessionId);
    console.log(`👤 User ${userId} joined session ${sessionId}`);
  });

  socket.on('audio-chunk', async (data) => {
    const { sessionId } = data;
    
    // Simulate transcription with random questions
    const sampleQuestions = [
      "What is React?",
      "What is JavaScript?", 
      "What is Node.js?",
      "What is Python?",
      "Hello"
    ];
    
    const randomQuestion = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
    console.log(`🎤 Simulated transcription: "${randomQuestion}"`);
    
    // Emit live transcript
    io.to(sessionId).emit('live_transcript_chunk', {
      text: randomQuestion
    });
    
    // Wait a moment then generate response
    setTimeout(() => {
      console.log(`🤖 Generating response for: "${randomQuestion}"`);
      
      // Find matching response
      const questionKey = randomQuestion.toLowerCase();
      let response = demoResponses.default;
      
      for (const [key, value] of Object.entries(demoResponses)) {
        if (questionKey.includes(key)) {
          response = value;
          break;
        }
      }
      
      // Emit answer start
      socket.emit('answer_start', { question: randomQuestion });
      
      // Stream the response word by word
      const words = response.split(' ');
      let currentResponse = '';
      
      words.forEach((word, index) => {
        setTimeout(() => {
          currentResponse += (index > 0 ? ' ' : '') + word;
          socket.emit('answer_chunk', { chunk: (index > 0 ? ' ' : '') + word });
          
          // If last word, emit answer_end
          if (index === words.length - 1) {
            setTimeout(() => {
              socket.emit('answer_end', { 
                question: randomQuestion,
                answer: currentResponse 
              });
              console.log(`✅ Response complete for: "${randomQuestion}"`);
            }, 100);
          }
        }, index * 100); // 100ms delay between words
      });
      
    }, 1000); // 1 second delay before response
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`✅ Voice Demo running on port ${PORT}`);
  console.log(`🎤 No API keys needed - using simulation mode`);
  console.log(`🤖 Demo responses ready for common questions`);
  console.log(`📡 Socket.IO ready for voice connections`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`\n🎯 Ready for voice testing!`);
});
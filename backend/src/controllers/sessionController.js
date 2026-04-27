const db = require('../db');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const analyticsController = require('./analyticsController'); // Need to use its logic or import
const { addAiFeedbackJob } = require('../queues/aiQueue');

/**
 * Starts a new interview session.
 */
const startSession = async (req, res) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required.' });
  }
  
  try {
    const result = await db.query(
      'INSERT INTO sessions (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error starting session:', error);
    res.status(500).json({ success: false, message: 'Failed to start interview session.' });
  }
};

/**
 * Submits an answer to a session and gets AI feedback via Bull Queue.
 */
const submitAnswer = async (req, res) => {
  const { sessionId, question, answer } = req.body;
  
  if (!sessionId || !question || !answer) {
    return res.status(400).json({ success: false, message: 'Missing session ID, question, or answer.' });
  }

  try {
    // Dispatch to background queue for scalable processing
    const jobResult = await addAiFeedbackJob({ sessionId, question, answer });
    
    if (jobResult.status === 'completed-immediately') {
      res.status(201).json({
        success: true,
        data: jobResult.data
      });
    } else {
      res.status(202).json({
        success: true,
        message: 'Answer submitted and is currently being analysed by AI.',
        jobId: jobResult.id
      });
    }
  } catch (error) {
    logger.error('Error submitting answer:', error);
    res.status(500).json({ success: false, message: 'Failed to submit answer.' });
  }
};

/**
 * Generates the next question adaptively based on past weaknesses.
 */
const getNextQuestion = async (req, res) => {
  const { sessionId } = req.params;
  const { roleOrTopic } = req.query; // E.g., 'React Developer'
  
  // Validate sessionId format (assuming it's a number)
  if (!sessionId || isNaN(parseInt(sessionId))) {
    return res.status(400).json({ success: false, message: 'Invalid session ID format.' });
  }
  
  try {
    // Check if session exists
    const sessionCheck = await db.query('SELECT id FROM sessions WHERE id = $1', [sessionId]);
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }
    
    // 1. Get past answers to find weaknesses in the current session
    const answers = await db.query('SELECT score, ai_feedback FROM answers WHERE session_id = $1', [sessionId]);
    
    let weakTopicsContext = "";
    if (answers.rows.length > 0) {
      const recentWeaknesses = answers.rows
        .filter(a => a.score < 70 && a.ai_feedback)
        .map(a => {
          try {
            return JSON.parse(a.ai_feedback).weaknesses;
          } catch (e) {
            return [];
          }
        })
        .flat()
        .slice(-3); // Get the last 3 weaknesses
      
      if (recentWeaknesses.length > 0) {
        weakTopicsContext = `The candidate recently showed weaknesses in: ${recentWeaknesses.join(', ')}. Ask a question to test improvement in these areas.`;
      } else {
        weakTopicsContext = "The candidate is doing well. Ask an advanced question to increase difficulty.";
      }
    }
    
    const promptContext = roleOrTopic 
      ? `Role: ${roleOrTopic}. ${weakTopicsContext}` 
      : `General Interview. ${weakTopicsContext}`;
      
    // 2. Generate 1 question
    const questions = await aiService.generateQuestions(promptContext, 1);
    
    res.status(200).json({
      success: true,
      data: {
        nextQuestion: questions[0]
      }
    });

  } catch (error) {
    logger.error('Error generating next question:', error);
    res.status(500).json({ success: false, message: 'Failed to generate next question.' });
  }
};

/**
 * Gets a session and all its answers.
 */
const getSession = async (req, res) => {
  const { id } = req.params;
  try {
    const sessionResult = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    const answersResult = await db.query('SELECT * FROM answers WHERE session_id = $1', [id]);

    res.status(200).json({
      success: true,
      data: {
        ...sessionResult.rows[0],
        answers: answersResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching session:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session details.' });
  }
};

/**
 * Ends a session.
 */
const endSession = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Session ended successfully.',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error ending session:', error);
    res.status(500).json({ success: false, message: 'Failed to end session.' });
  }
};

module.exports = {
  startSession,
  submitAnswer,
  getNextQuestion,
  getSession,
  endSession
};

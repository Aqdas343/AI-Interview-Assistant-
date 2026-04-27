const db = require('../db');
const logger = require('../utils/logger');

const getPerformance = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Get all sessions for the user, ordered by time
    const sessionsQuery = 'SELECT id, started_at FROM sessions WHERE user_id = $1 ORDER BY started_at ASC';
    const sessions = await db.query(sessionsQuery, [userId]);
    const sessionIds = sessions.rows.map(s => s.id);

    if (sessionIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          averageScore: 0,
          progress: [],
          topics: {},
          improvement: '0%',
          message: 'No interview sessions found.'
        }
      });
    }

    // Get all answers ordered by creation to plot progress
    const answersQuery = `
      SELECT session_id, score, ai_feedback, question, created_at
      FROM answers 
      WHERE session_id = ANY($1::int[])
      ORDER BY created_at ASC
    `;
    const answers = await db.query(answersQuery, [sessionIds]);

    if (answers.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          averageScore: 0,
          progress: [],
          topics: {},
          improvement: '0%',
          message: 'No answers found in sessions.'
        }
      });
    }

    // Calculate metrics
    let totalScore = 0;
    const progress = [];
    const topicsScores = {};
    const topicsCounts = {};

    answers.rows.forEach(a => {
      const s = a.score || 0;
      totalScore += s;
      progress.push(s);

      // Advanced topic breakdown mock based on question content
      const qLower = a.question.toLowerCase();
      let topic = 'General';
      if (qLower.includes('react') || qLower.includes('hook')) topic = 'React';
      if (qLower.includes('node') || qLower.includes('express')) topic = 'Node.js';
      if (qLower.includes('array') || qLower.includes('sort') || qLower.includes('tree')) topic = 'DSA';
      if (qLower.includes('database') || qLower.includes('sql')) topic = 'Database';

      if (!topicsScores[topic]) {
        topicsScores[topic] = 0;
        topicsCounts[topic] = 0;
      }
      topicsScores[topic] += s;
      topicsCounts[topic] += 1;
    });

    const averageScore = Math.round(totalScore / answers.rows.length);

    const topics = {};
    for (const key in topicsScores) {
      topics[key] = Math.round(topicsScores[key] / topicsCounts[key]);
    }

    // Mock improvement logic
    let improvement = '0%';
    if (progress.length > 1) {
      const firstScore = progress[0];
      const lastScore = progress[progress.length - 1];
      if (firstScore > 0) {
        const diff = Math.round(((lastScore - firstScore) / firstScore) * 100);
        improvement = diff > 0 ? `+${diff}%` : `${diff}%`;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        averageScore,
        progress,
        topics,
        improvement
      }
    });

  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
};

module.exports = {
  getPerformance
};

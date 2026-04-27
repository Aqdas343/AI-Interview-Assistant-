const fs = require('fs');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const uploadAndTranscribe = async (req, res) => {
  try {
    if (!req.file) {
      throw new AppError('No audio file provided', 400);
    }

    const audioStream = fs.createReadStream(req.file.path);
    const transcript = await aiService.transcribeAudio(audioStream);

    // 🔒 Important for Windows: Destroy the stream to release the file lock
    audioStream.destroy();

    // Clean up the file after processing
    try {
      await fs.promises.unlink(req.file.path);
    } catch (err) {
      logger.error(`Failed to delete temporary audio file: ${req.file.path}`, err);
    }

    res.status(200).json({
      success: true,
      message: 'Audio transcribed successfully',
      data: {
        transcript
      }
    });
  } catch (error) {
    logger.error('Error in audio upload/transcribe pipeline:', error);
    
    // Attempt cleanup on failure
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (unlinkErr) {
        logger.error(`Cleanup failed for ${req.file.path}:`, unlinkErr);
      }
    }
    
    throw new AppError('Failed to transcribe audio. Please try again.', 500);
  }
};

module.exports = {
  uploadAndTranscribe
};

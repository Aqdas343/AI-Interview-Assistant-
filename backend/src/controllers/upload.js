const logger = require('../utils/logger');

const uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded' });
  }

  logger.info(`File uploaded successfully: ${req.file.filename}`);

  res.status(200).json({
    status: 'success',
    message: 'File uploaded successfully',
    file: {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
};

module.exports = {
  uploadFile
};

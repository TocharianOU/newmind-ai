import logger from '../utils/logger.js';
import { createResponse } from '../config/constants.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err);

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(400).json(
      createResponse(null, 'Duplicate entry')
    );
  }

  if (err.code === 'P2025') {
    return res.status(404).json(
      createResponse(null, 'Record not found')
    );
  }

  // Default error
  res.status(err.status || 500).json(
    createResponse(null, err.message || 'Internal server error')
  );
};

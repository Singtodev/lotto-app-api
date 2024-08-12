import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
const lottoValidationRules = [
    body('expired_date')
    .isISO8601().toDate()
    .withMessage('Invalid date format. Use ISO 8601 format (e.g., 2024-08-12T18:17:15.000Z)'),
    body('count')
      .isInt({ min: 1, max: 1000000 })
      .withMessage('Count must be between 1 and 1,000,000'),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a non-negative number'),
  ];
  // Middleware สำหรับตรวจสอบ validation results
  const checkValidationResult = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

export { lottoValidationRules , checkValidationResult}
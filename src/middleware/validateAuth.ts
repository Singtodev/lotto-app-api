import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

const validateAuthRegisterBody = [
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Phone number must be exactly 10 characters long'),
  body('last_name')
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Last name must be between 3 and 20 characters'),
  body('first_name')
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('First name must be between 3 and 20 characters'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 32 })
    .withMessage('Password must be between 8 and 32 characters'),
  body('password_confirmation')
    .notEmpty().withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateAuthLoginBody = [
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Phone number must be exactly 10 characters long'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 32 })
    .withMessage('Password must be between 8 and 32 characters'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

export { validateAuthRegisterBody, validateAuthLoginBody };
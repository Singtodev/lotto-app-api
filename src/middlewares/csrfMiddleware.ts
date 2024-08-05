import { Request, Response, NextFunction } from 'express';
import csrf from 'csurf';

// สร้าง CSRF protection middleware
const csrfProtection = csrf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    sameSite: 'strict'
  }
});


// Middleware สำหรับตรวจสอบ CSRF token
export const checkCsrf = (req: Request, res: Response, next: NextFunction) => {
  csrfProtection(req, res, (error: any) => {
    if (error) {
      // ถ้ามี error (CSRF token ไม่ถูกต้องหรือไม่มี)
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next();
  });
};

// Middleware สำหรับสร้าง CSRF token
export const generateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  csrfProtection(req, res, (error: any) => {
    if (error) {
      return next(error);
    }
    // สร้าง CSRF token และเพิ่มลงใน response
    res.locals.csrfToken = req.csrfToken();
    next();
  });
};



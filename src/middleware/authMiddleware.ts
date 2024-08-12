const jwt = require('jsonwebtoken');
import  {Request, Response , NextFunction } from 'express';
const authMiddleware = (req:Request | any , res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'ไม่พบ token กรุณาเข้าสู่ระบบ' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    // console.log("Token Expired in : " , (decoded.exp - currentTimestamp));
    if (decoded.exp && decoded.exp < currentTimestamp) {
      return res.status(401).json({ error: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token ไม่ถูกต้อง' });
  }
};

export { authMiddleware}
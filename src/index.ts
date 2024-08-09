import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { adminRouter, authRouter, lottoRouter, userRouter, walletRouter } from './routers/_index';
import cookieParser from 'cookie-parser';
import { checkCsrf, generateCsrfToken } from './middlewares/csrfMiddleware';
import rateLimit from 'express-rate-limit';

dotenv.config();
const app = express();
const port = process.env.PORT || 8000;

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 นาที
  max: 1000 // จำกัด 1000 คำขอต่อ IP ใน 10 นาที
});

app.use(limiter);
app.use(cookieParser());
app.get('/get-csrf-token', generateCsrfToken, (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});
app.get('/', (req: Request, res: Response) => {
  res.send('Hello World : [ Bid Lotto API ]');
});
app.use('/api/users',checkCsrf, userRouter);
app.use('/api/wallet',checkCsrf, walletRouter);
app.use('/api/lotto',checkCsrf, lottoRouter);
app.use('/api/admin',checkCsrf, adminRouter);
app.use('/api/auth',checkCsrf,authRouter);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
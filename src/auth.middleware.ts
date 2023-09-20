import { Request, Response, NextFunction } from 'express';

export function authorization(req: Request, res: Response, next: NextFunction) {
  if (
    req.get('Authorization') !== process.env.AUTHORIZATION &&
    req.get('Authorization') !== process.env.JAMBO_AUTHORIZATION
  ) {
    res.send('Authorization Failed');
    return;
  }
  next();
}

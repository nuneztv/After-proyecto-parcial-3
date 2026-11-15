import Boom from '@hapi/boom';
import { Request, Response } from 'express';
import { getUserFromRequest } from '../../middlewares/authMiddleware';
import { uploadImageService } from './upload.service';

export const uploadImageController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  if (!req.file) {
    throw Boom.badRequest('Image is required');
  }

  res.status(201).json(await uploadImageService(user.id, req.file));
};

import AnimeController from 'backend/controllers/anime-controller';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  switch (method) {
    case 'GET':
      await AnimeController.list(req, res);
      break;
    default:
      res.status(405).end();
      break;
  }
}

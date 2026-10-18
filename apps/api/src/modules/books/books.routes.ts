import { Router } from 'express';
import { currentUser } from '../../middleware/authenticate';
import { getBook, listBooks } from './books.service';

export const booksRouter = Router();

booksRouter.get('/', async (req, res) => {
  res.json(await listBooks(currentUser(req)));
});

booksRouter.get('/:bookId', async (req, res) => {
  res.json({ book: await getBook(currentUser(req), req.params.bookId) });
});

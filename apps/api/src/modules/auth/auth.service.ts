import bcrypt from 'bcryptjs';
import type { LoginInput, SessionUser } from '@bookleaf/shared';
import { unauthorized } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { signSession } from '../../middleware/authenticate';

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

export async function login(input: LoginInput): Promise<{ token: string; user: SessionUser }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { author: { select: { id: true } } },
  });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Incorrect email or password');

  return {
    token: signSession(user),
    user: { id: user.id, email: user.email, name: user.name, role: user.role, authorId: user.author?.id ?? null },
  };
}

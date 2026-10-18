import type { Role } from '@bookleaf/shared';

export const homeFor = (role: Role) => (role === 'ADMIN' ? '/admin/tickets' : '/books');

/**
 * Decides whether a user may log in / use the API right now.
 * Returns null when access is fine, otherwise { code, message }.
 *
 * - Banned users are always blocked.
 * - Owners/employees of a PENDING or REJECTED store are blocked.
 * - Employees of a BANNED store are blocked. The OWNER of a banned store is
 *   still allowed in (so they can see the ban notice and send an appeal); the
 *   store-scoped routes themselves refuse to work while the store is banned.
 */
function accessGate(user, store) {
  if (user.banned) {
    return {
      code: 'ACCOUNT_BANNED',
      message: `This account has been banned.${user.banReason ? ` Reason: ${user.banReason}` : ''}`,
    };
  }

  if (user.storeId && user.role !== 'admin') {
    if (!store) {
      return { code: 'STORE_INACTIVE', message: 'The store linked to this account no longer exists.' };
    }
    if (store.status === 'pending') {
      return {
        code: 'STORE_PENDING',
        message: 'Your store application is still waiting for admin approval. Please check back later.',
      };
    }
    if (store.status === 'rejected') {
      return {
        code: 'STORE_REJECTED',
        message: `Your store application was not approved.${
          store.rejectionReason ? ` Reason: ${store.rejectionReason}` : ''
        }`,
      };
    }
    if (store.status === 'banned' && ['employee', 'rider'].includes(user.role)) {
      return {
        code: 'STORE_INACTIVE',
        message: 'This store is currently suspended. Please contact your store owner.',
      };
    }
  }

  return null;
}

module.exports = accessGate;

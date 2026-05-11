import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ error, event }) => {
  console.error('[SVELTEKIT UNHANDLED ERROR]:', error);
  return {
    message: 'Internal Error'
  };
};

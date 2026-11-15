import { isAxiosError } from 'axios';

export const getErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    if (!error.response) return 'We could not reach the After API';

    const data = error.response.data as { message?: unknown } | undefined;
    return typeof data?.message === 'string' ? data.message : error.message;
  }

  return error instanceof Error ? error.message : 'Something went wrong';
};

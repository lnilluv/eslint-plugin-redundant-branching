// HTTP error handler — existing code with switch statements

type ErrorCode = 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR' | 'TIMEOUT';

export function handleError(code: ErrorCode) {
  let title: string;
  let message: string;

  if (code === 'NOT_FOUND') {
    title = 'Not Found';
  } else if (code === 'UNAUTHORIZED') {
    title = 'Unauthorized';
  } else if (code === 'FORBIDDEN') {
    title = 'Access Denied';
  } else if (code === 'SERVER_ERROR') {
    title = 'Server Error';
  } else {
    title = 'Request Timeout';
  }

  if (code === 'NOT_FOUND') {
    message = 'The resource you requested could not be found.';
  } else if (code === 'UNAUTHORIZED') {
    message = 'Please sign in to continue.';
  } else if (code === 'FORBIDDEN') {
    message = 'You do not have permission to access this resource.';
  } else if (code === 'SERVER_ERROR') {
    message = 'An unexpected error occurred. Please try again.';
  } else {
    message = 'The request took too long. Please try again.';
  }

  return { title, message };
}

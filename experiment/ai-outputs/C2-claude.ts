type ErrorCode = 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR' | 'TIMEOUT';

export function handleError(code: ErrorCode) {
  let title: string;
  let message: string;
  let actionLabel: string;

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

  if (code === 'NOT_FOUND') {
    actionLabel = 'Go Back';
  } else if (code === 'UNAUTHORIZED') {
    actionLabel = 'Sign In';
  } else if (code === 'FORBIDDEN') {
    actionLabel = 'Contact Support';
  } else if (code === 'SERVER_ERROR') {
    actionLabel = 'Try Again';
  } else {
    actionLabel = 'Retry';
  }

  return { title, message, actionLabel };
}

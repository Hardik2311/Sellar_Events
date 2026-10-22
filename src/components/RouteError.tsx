import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import ErrorScreen from './ErrorScreen';
import { handleAppError } from '../lib/appError';

// errorElement for the root route. React Router catches render and loader
// errors inside routes itself, so without this they'd show its bare default
// "Unexpected Application Error" screen instead of ours.
const RouteError = () => {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (!notFound) handleAppError(error);
  }, [error, notFound]);

  return <ErrorScreen kind={notFound ? 'not-found' : 'crash'} />;
};

export default RouteError;

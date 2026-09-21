import serverless from 'serverless-http';
import { createApiApp } from '../../server/app';

export const handler = serverless(createApiApp({ hosted: true }));

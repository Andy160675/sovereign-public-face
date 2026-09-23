import { createWebhookHandler } from './promotion-fix.js';

// Stripe's signature covers the exact bytes received by this function.
export const config={api:{bodyParser:false}};
export default createWebhookHandler();

import express from 'express';
import { createCheckoutSession, getSessionDetails } from '../controllers/paymentController.js';

const router = express.Router();

/**
 * POST /api/payment/checkout
 * Create a new Stripe checkout session
 * Multi-vendor SaaS compatible
 * 
 * Body Parameters:
 * - cartItems (Array): Array of items in cart [{ id, name, price, quantity, description, image }]
 * - branchId (String): Branch/Restaurant ID
 * - owner_id (String): Owner/Vendor ID (required for multi-vendor setup)
 * 
 * Response:
 * - success (Boolean): Whether checkout session was created
 * - sessionUrl (String): Stripe checkout URL to redirect user to
 * - sessionId (String): Unique checkout session ID
 * - ownerId (String): Echo of the owner_id
 */
router.post('/checkout', createCheckoutSession);

/**
 * POST /api/payment/session/:sessionId
 * Retrieve details of a specific payment session
 * Multi-vendor SaaS compatible
 * 
 * URL Parameters:
 * - sessionId (String): Stripe session ID
 * 
 * Body Parameters:
 * - owner_id (String): Owner/Vendor ID (required to access correct Stripe account)
 * 
 * Response:
 * - success (Boolean): Whether session was retrieved
 * - session (Object): Session details including payment status
 *   - id (String): Session ID
 *   - paymentStatus (String): 'paid', 'unpaid', 'no_payment_required'
 *   - customerEmail (String): Customer email
 *   - branchId (String): Branch ID
 *   - ownerId (String): Owner ID
 *   - totalAmount (Number): Total amount in INR
 */
router.post('/session/:sessionId', getSessionDetails);

export default router;

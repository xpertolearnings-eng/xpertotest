const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY)),
  });
}
const db = admin.firestore();

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const signature = event.headers['x-razorpay-signature'];
  const rawBody = event.body;

  try {
    // 1. Verify Webhook Signature
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Invalid Razorpay webhook signature.');
      return { statusCode: 400, body: 'Invalid signature' };
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    
    // 2. Handle the 'payment.captured' event
    if (eventType === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const { jobId, userId } = paymentEntity.notes;

      if (!orderId || !jobId || !userId) {
        console.error('Webhook payload missing required notes (jobId, userId).', paymentEntity.notes);
        return { statusCode: 400, body: 'Missing required data in payment notes.' };
      }
      
      const paymentRef = db.collection('payments').doc(orderId);
      const jobRef = db.collection('jobs').doc(jobId);

      // 3. Use a transaction to ensure atomicity and idempotency
      await db.runTransaction(async (transaction) => {
        const paymentDoc = await transaction.get(paymentRef);
        const jobDoc = await transaction.get(jobRef);

        // Idempotency check: if job is already unlocked, do nothing.
        if (jobDoc.exists && jobDoc.data().unlocked) {
          console.log(`Job ${jobId} is already unlocked. Skipping update.`);
          return;
        }

        // Update payment document
        transaction.update(paymentRef, {
          status: 'captured',
          paymentId: paymentEntity.id,
          capturedAt: admin.firestore.Timestamp.fromMillis(paymentEntity.created_at * 1000),
        });

        // Update job document to unlock it and add payment metadata
        transaction.update(jobRef, {
          unlocked: true,
          paymentDetails: {
            paymentId: paymentEntity.id,
            orderId: orderId,
            amount: paymentEntity.amount / 100, // convert back to rupees
            currency: paymentEntity.currency,
            method: paymentEntity.method,
            paidAt: admin.firestore.Timestamp.fromMillis(paymentEntity.created_at * 1000),
          },
        });
      });
      
      console.log(`Successfully processed payment and unlocked job ${jobId}.`);
    }

    return { statusCode: 200, body: 'Webhook processed.' };
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

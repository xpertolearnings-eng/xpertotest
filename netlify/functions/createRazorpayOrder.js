const admin = require('firebase-admin');
const Razorpay = require('razorpay');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY)),
  });
}

const db = admin.firestore();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify Firebase ID Token
  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  const idToken = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    return { statusCode: 401, body: 'Unauthorized: Invalid token' };
  }

  const { uid } = decodedToken;
  const { jobId } = JSON.parse(event.body);

  if (!jobId) {
    return { statusCode: 400, body: 'Bad Request: Missing jobId.' };
  }

  try {
    // Fetch the job to ensure ownership and get the price
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return { statusCode: 404, body: 'Job not found.' };
    }

    const jobData = jobDoc.data();
    if (jobData.userId !== uid) {
      return { statusCode: 403, body: 'Forbidden: You do not own this job.' };
    }

    if (jobData.unlocked) {
        return { statusCode: 400, body: 'Bad Request: This job is already unlocked.' };
    }

    // Create Razorpay order
    const options = {
      amount: jobData.price_paise, // amount in the smallest currency unit
      currency: 'INR',
      receipt: `receipt_job_${jobId}`,
      notes: {
        jobId: jobId,
        userId: uid,
      },
    };

    const order = await razorpay.orders.create(options);

    // Store payment details in Firestore
    await db.collection('payments').doc(order.id).set({
      jobId: jobId,
      userId: uid,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: 'created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        order,
        key: process.env.RAZORPAY_KEY_ID,
      }),
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create payment order.' }),
    };
  }
};

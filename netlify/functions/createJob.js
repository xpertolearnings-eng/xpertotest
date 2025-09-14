const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// This expects a FIREBASE_SERVICE_KEY environment variable in Netlify,
// which is a JSON string of your service account key.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY)),
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const idToken = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return { statusCode: 401, body: 'Unauthorized: Invalid token' };
  }

  const { uid } = decodedToken;
  const { fileUrl, filename, linkedinUrl } = JSON.parse(event.body);

  if (!uid || (!fileUrl && !linkedinUrl)) {
    return { statusCode: 400, body: 'Bad Request: Missing required fields.' };
  }

  try {
    const jobRef = await db.collection('jobs').add({
      userId: uid,
      fileUrl: fileUrl || null,
      linkedinUrl: linkedinUrl || null,
      filename: filename || 'LinkedIn Profile',
      status: 'pending',
      preview: null,
      fullReport: null,
      unlocked: false,
      price_paise: 900,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      retryCount: 0,
      error: null,
    });

    console.log(`Job created successfully for user ${uid} with ID: ${jobRef.id}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ jobId: jobRef.id }),
    };
  } catch (error) {
    console.error('Error creating Firestore job document:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create job.' }),
    };
  }
};

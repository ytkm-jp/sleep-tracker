const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const adminUid = 'UHi5BIbO0jXYxNLQlDM70xTRwqh1';

async function setAdminClaim() {
    try {
        await admin.auth().setCustomUserClaims(adminUid, { admin: true });
        console.log(`✅ Admin Claim set for: ${adminUid}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setAdminClaim();

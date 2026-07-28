const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

exports.createUser = onCall(async (request) => {
    const { auth, data } = request;

    // Ensure the user is authenticated
    if (!auth) {
        throw new HttpsError(
            "unauthenticated",
            "User must be logged in."
        );
    }

    // Retrieve the company ID (we renamed tenantId to companyId previously)
    const companyId = data.companyId;

    if (!companyId) {
        throw new HttpsError(
            "invalid-argument",
            "Company ID is required."
        );
    }

    try {
    const companyRef = db.collection("companies").doc(companyId);

    const newUser = {
      name: data.name,
      email: data.email,
      role: data.role || "staff",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // uid ko hi doc ID banaya taaki rules mein match easy ho 
    await companyRef.collection("users").doc(auth.uid).set(newUser);

    // Custom claims
    await admin.auth().setCustomUserClaims(auth.uid, {
      companyId,
      role: newUser.role,
    });

    return { success: true, message: "User created successfully" };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});
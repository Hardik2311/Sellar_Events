const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

exports.createUser = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be logged in."
        );
    }

    // Retrieve the tenant ID (Example assumes it's passed in the data payload)
    const tenantId = data.tenantId;

    if (!tenantId) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Tenant ID is required."
        );
    }

    try {
    const tenantRef = db.collection("tenants").doc(tenantId);

    const newUser = {
      name: data.name,
      email: data.email,
      role: data.role || "staff",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // uid ko hi doc ID banaya taaki rules mein match easy ho 
    await tenantRef.collection("users").doc(context.auth.uid).set(newUser);

    // Custom claims — rules isse tenant + role check karengi
    await admin.auth().setCustomUserClaims(context.auth.uid, {
      tenantId,
      role: newUser.role,
    });

    return { success: true, message: "User created successfully" };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});
const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.createTenant = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in."
    );
  }

  const { fullName, organizationName, eventCategory, website, whatsappNumber, address } = data;

  if (!fullName || !organizationName || !eventCategory) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Full name, organization name and event category are required."
    );
  }

  try {
    const tenantRef = db.collection("tenants").doc(); // auto-generated tenantId

    await tenantRef.set({
      organizationName,
      eventCategory,
      website: website || "",
      whatsappNumber: whatsappNumber || "",
      address: address || {},
      ownerUid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await tenantRef.collection("users").doc(context.auth.uid).set({
      fullName,
      email: context.auth.token.email || "",
      role: "admin",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.auth().setCustomUserClaims(context.auth.uid, {
      tenantId: tenantRef.id,
      role: "admin",
    });

    return { success: true, tenantId: tenantRef.id };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});
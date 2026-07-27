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

    // TODO: Add logic here to verify context.auth.uid actually belongs to tenantId

    try {
        // Isolate data by scoping it under a specific tenant document
        const tenantRef = db.collection("tenants").doc(tenantId);

        const newUser = {
            name: data.name,
            email: data.email,
            role: data.role || "staff",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Save the user inside the tenant's subcollection
        await tenantRef.collection("users").add(newUser);

        return { success: true, message: "User created successfully" };
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
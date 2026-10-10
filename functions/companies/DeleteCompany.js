const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Keep in sync with SUPER_ADMIN_UIDS in src/pages/SuperAdmin/*.tsx and
// isSuperAdmin() in firestore.rules.
const SUPER_ADMIN_UIDS = ["sR4lj7OfkAc7DhdxfHhuC7XAzLC2"];

exports.deleteCompanyData = onCall(async (request) => {
    const { auth, data } = request;

    if (!auth || !SUPER_ADMIN_UIDS.includes(auth.uid)) {
        throw new HttpsError("permission-denied", "Only Super Admins can perform this action.");
    }

    const { companyId } = data || {};
    if (!companyId) {
        throw new HttpsError("invalid-argument", "Missing companyId.");
    }

    try {
        const usersSnapshot = await db.collection(`companies/${companyId}/users`).get();

        await Promise.all(
            usersSnapshot.docs.map((doc) =>
                admin.auth().deleteUser(doc.id).catch((err) => {
                    // A user already removed from Auth (or never created there)
                    // shouldn't block deleting the rest of the company's data.
                    console.warn(`Could not delete Auth user ${doc.id}:`, err.message);
                })
            )
        );

        await db.recursiveDelete(db.doc(`companies/${companyId}`));

        return { success: true, message: `Company ${companyId} deleted.` };
    } catch (error) {
        console.error("Error deleting company:", error);
        throw new HttpsError("internal", "An error occurred while deleting the company.");
    }
});

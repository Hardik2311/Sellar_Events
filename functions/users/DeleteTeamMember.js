const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Role hierarchy: who is allowed to delete whom
const ALLOWED_TO_DELETE = {
    admin: ["admin", "team_leader", "team"],  // admins can delete other admins too
    team_leader: ["team"],
};

exports.deleteTeamMember = onCall(async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { companyId, targetUid } = data;

    if (!companyId || !targetUid) {
        throw new HttpsError("invalid-argument", "companyId and targetUid are required.");
    }

    if (targetUid === auth.uid) {
        throw new HttpsError("failed-precondition", "You cannot delete your own account here.");
    }

    const usersRef = db.collection("companies").doc(companyId).collection("users");

    // 1. Confirm caller belongs to this company and get their role
    const callerDoc = await usersRef.doc(auth.uid).get();
    if (!callerDoc.exists) {
        throw new HttpsError("permission-denied", "You are not part of this company.");
    }
    const callerRole = callerDoc.data().role;

    // 2. Confirm the target exists and get their role
    const targetDoc = await usersRef.doc(targetUid).get();
    if (!targetDoc.exists) {
        throw new HttpsError("not-found", "User not found.");
    }
    const targetRole = targetDoc.data().role;

        // 3. Check hierarchy permission
    const allowedRoles = ALLOWED_TO_DELETE[callerRole] || [];
    if (!allowedRoles.includes(targetRole)) {
        throw new HttpsError(
            "permission-denied",
            `A ${callerRole} is not allowed to delete a ${targetRole}.`
        );
    }

    // 3b. Safety guard: don't allow the LAST remaining admin to be deleted,
    // so a company can never end up with zero owners.
    if (targetRole === "admin") {
        const adminCountSnap = await usersRef.where("role", "==", "admin").get();
        if (adminCountSnap.size <= 1) {
            throw new HttpsError(
                "failed-precondition",
                "You cannot delete the last remaining Owner/Admin of this company."
            );
        }
    }

    try {
        // 4. Delete the Firebase Auth account (revokes login access)
        await admin.auth().deleteUser(targetUid);

        // 5. Delete their Firestore profile
        await usersRef.doc(targetUid).delete();

        return { success: true, message: "User deleted successfully." };
    } catch (error) {
        // If the auth user was already gone, still clean up Firestore
        if (error.code === "auth/user-not-found") {
            await usersRef.doc(targetUid).delete();
            return { success: true, message: "User doc removed (auth account was already gone)." };
        }
        throw new HttpsError("internal", error.message);
    }
});
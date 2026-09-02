const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Role hierarchy: who is allowed to create whom
const ALLOWED_TO_CREATE = {
    admin: ["admin", "team_leader", "team"],  // admins can now create other admins (multi-owner)
    team_leader: ["team"],
};

exports.addTeamMember = onCall(async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { companyId, name, phone, email, password, role } = data;

    if (!companyId || !name || !email || !password || !role) {
        throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    // 1. Confirm the caller actually belongs to this company and get their role
    const callerDocRef = db.collection("companies").doc(companyId).collection("users").doc(auth.uid);
    const callerDoc = await callerDocRef.get();

    if (!callerDoc.exists) {
        throw new HttpsError("permission-denied", "You are not part of this company.");
    }

    const callerRole = callerDoc.data().role;
    const allowedRoles = ALLOWED_TO_CREATE[callerRole] || [];

    if (!allowedRoles.includes(role)) {
        throw new HttpsError(
            "permission-denied",
            `A ${callerRole} is not allowed to create a ${role}.`
        );
    }

    try {
        // 2. Create the actual Firebase Auth account
        const newUserRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });

        // 3. Set custom claims so the new user's session knows their company + role
        await admin.auth().setCustomUserClaims(newUserRecord.uid, {
            companyId,
            role,
        });

        // 4. Write their profile doc under the company
        await db
            .collection("companies")
            .doc(companyId)
            .collection("users")
            .doc(newUserRecord.uid)
            .set({
                name,
                phone: phone || "",
                email,
                role,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

        return { success: true, uid: newUserRecord.uid };
    } catch (error) {
        if (error.code === "auth/email-already-exists") {
            throw new HttpsError("already-exists", "This email is already registered.");
        }
        throw new HttpsError("internal", error.message);
    }
});
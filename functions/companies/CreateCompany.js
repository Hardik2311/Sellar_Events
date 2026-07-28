const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.createCompany = onCall(async (request) => {
  const { auth, data } = request;
  const uid = auth?.uid;
  const email = auth?.token?.email;

  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "User must be logged in."
    );
  }

  const { fullName, organizationName, eventCategory, website, whatsappNumber, address } = data;

  if (!fullName || !organizationName || !eventCategory) {
    throw new HttpsError(
      "invalid-argument",
      "Full name, organization name and event category are required."
    );
  }

  try {
    // Generate CMP-XXXX ID
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const companyId = `CMP-${randomNum}`;
    const companyRef = db.collection("companies").doc(companyId);

    const now = admin.firestore.Timestamp.now();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);

    // Write root document fields matching screenshot exactly
    await companyRef.set({
      createdAt: now,
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      isTrial: true,
      name: organizationName,
      ownerPhoneNumber: whatsappNumber || "",
      ownerUID: uid,
      pack: "enterprise",
      referralDetails: null,
      validity: "active"
    });

    // Write business_info
    await companyRef.collection("business_info").doc("profile").set({
      organizationName,
      eventCategory,
      website: website || "",
      whatsappNumber: whatsappNumber || "",
      address: address || {},
      updatedAt: now,
    });

    // Write placeholder for permissions
    await companyRef.collection("permissions").doc("default").set({ initialized: true });
    
    // Write placeholder for cata_permissions
    await companyRef.collection("cata_permissions").doc("default").set({ initialized: true });
    
    // Write placeholder for settings
    await companyRef.collection("settings").doc("default").set({ initialized: true });

    // Write users
    await companyRef.collection("users").doc(uid).set({
      fullName,
      email: email || "",
      role: "admin",
      createdAt: now,
    });

    // Set auth claims
    await admin.auth().setCustomUserClaims(uid, {
      companyId: companyId,
      role: "admin",
    });

    return { success: true, companyId: companyId };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

const { HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const RAZORPAY_API = "https://api.razorpay.com/v1";
const PAYMENTS_REGION = "asia-south1";

// The PLATFORM's own Razorpay account — every online ticket payment lands
// here; organizers are paid out manually (see recordPayout.js). Set with:
//   firebase functions:secrets:set RAZORPAY_KEY_ID
//   firebase functions:secrets:set RAZORPAY_KEY_SECRET
//   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const RAZORPAY_SECRETS = [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET];

const getPlatformCredentials = () => {
    const keyId = (RAZORPAY_KEY_ID.value() || "").trim();
    const keySecret = (RAZORPAY_KEY_SECRET.value() || "").trim();
    if (!keyId || !keySecret) {
        throw new HttpsError("failed-precondition", "GATEWAY_NOT_CONFIGURED");
    }
    return { keyId, keySecret, webhookSecret: (RAZORPAY_WEBHOOK_SECRET.value() || "").trim() };
};

/**
 * Minimal Razorpay REST client (Basic auth with the platform keys).
 * Rejects with an Error carrying `statusCode` and Razorpay's error description.
 */
const razorpayRequest = async (creds, method, path, body) => {
    const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
    const res = await fetch(`${RAZORPAY_API}${path}`, {
        method,
        headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error((json.error && json.error.description) || `Razorpay ${res.status}`);
        err.statusCode = res.status;
        err.razorpay = json.error || null;
        throw err;
    }
    return json;
};

module.exports = {
    db,
    getPlatformCredentials,
    razorpayRequest,
    RAZORPAY_SECRETS,
    PAYMENTS_REGION,
};

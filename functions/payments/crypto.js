const crypto = require("crypto");

// Constant-time HMAC-SHA256 check used for both the checkout signature and webhooks.
const hmacMatches = (data, signature, secret) => {
    if (!signature || !secret) return false;
    const expected = crypto.createHmac("sha256", secret).update(data).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { hmacMatches };

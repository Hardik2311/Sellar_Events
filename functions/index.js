/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const { createUser } = require("./users/CreateUser");
const { addTeamMember } = require("./users/AddTeamMember");
const { deleteTeamMember } = require("./users/DeleteTeamMember");
const { createCompany } = require("./companies/CreateCompany");
const { deleteCompanyData } = require("./companies/DeleteCompany");
exports.createUser = createUser;
exports.addTeamMember = addTeamMember;
exports.deleteTeamMember = deleteTeamMember; // NEW
exports.createCompany = createCompany;
exports.deleteCompanyData = deleteCompanyData; // NEW

// Razorpay ticket payments into the PLATFORM account + manual organizer
// payouts — region asia-south1
const { createRazorpayOrder } = require("./payments/createRazorpayOrder");
const { verifyRazorpayPayment } = require("./payments/verifyRazorpayPayment");
const { razorpayWebhook } = require("./payments/razorpayWebhook");
const { releaseExpiredOrders } = require("./payments/releaseExpiredOrders");
const { recordPayout } = require("./payments/recordPayout");
const { createCreditOrder, verifyCreditPayment } = require("./payments/creditPurchases");
exports.createRazorpayOrder = createRazorpayOrder;
exports.verifyRazorpayPayment = verifyRazorpayPayment;
exports.razorpayWebhook = razorpayWebhook;
exports.releaseExpiredOrders = releaseExpiredOrders;
exports.recordPayout = recordPayout;
exports.createCreditOrder = createCreditOrder;
exports.verifyCreditPayment = verifyCreditPayment;

// Super Admin → Send Tickets: emails ticket PDFs via Gmail — region asia-south1
const { sendTicketEmail, markTicketEmails } = require("./email/sendTicketEmail");
exports.sendTicketEmail = sendTicketEmail;
exports.markTicketEmails = markTicketEmails;

// Emails the buyer their ticket PDFs right after an online booking (paid or
// free) — Firestore trigger, region asia-south2 (the database's region)
const { autoSendTicketEmail } = require("./email/autoSendTicketEmail");
exports.autoSendTicketEmail = autoSendTicketEmail;

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

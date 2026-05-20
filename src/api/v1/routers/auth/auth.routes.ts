import express from "express";
import {
	AnonimusLogin,
	googleAuthUser,
	loginAdmin,
	loginOrganizer,
	loginUser,
	signUpAdmin,
	signUpOrganizer,
	signUpUser
} from "../../controllers/auth/auth.controller";
import { hashPassword } from "../../../../middleware/auth/hashPassword.middleware";
import {
	checkAdminExistenceMiddleware,
	checkProviderExistenceMiddleware,
	checkUserExistenceMiddleware
} from "../../../../middleware/validation/checkUserExistence.middleware";
import {
	validateAdminExistenceMiddleware,
	validateProviderExistenceMiddleware,
	validateUserExistenceMiddleware
} from "../../../../middleware/validation/validateUserExistance.middleware";
import { getOtp, sendOtp, verifyOtp } from "../../controllers/auth/otp.controller";

const router = express.Router();

// OTP routes with MSG91 integration
router.route("/get-otp").post(getOtp); // Original method with custom OTP generation
router.route("/send-otp").post(sendOtp); // New method using MSG91's built-in OTP service
router.route("/verify-otp").post(verifyOtp); // New method to verify OTP

router.route("/user-signup").post(checkUserExistenceMiddleware, signUpUser);
router.route("/user-login").post(validateUserExistenceMiddleware, loginUser);
router.route("/anonimus-login").post(AnonimusLogin);
router.route("/google-auth").post(googleAuthUser);

router.route("/organizer-signup").post(checkProviderExistenceMiddleware, signUpOrganizer);
router.route("/organizer-login").post(validateProviderExistenceMiddleware, loginOrganizer);

router.route("/admin-signup").post(checkAdminExistenceMiddleware, signUpAdmin);
router.route("/admin-login").post(validateAdminExistenceMiddleware, loginAdmin);

module.exports = router;

import express from "express";
import {
	getOrganizerDetails,
	updateOrganizerDetails,
	updateOrganizerDocuments,
	updateProfilePic,
	addStaff,
	getStaffList,
	deleteStaff
} from "../../controllers/organizer/organizer.controller";
import { upload } from "../../../../middleware/multer.middleware";
import { getOrganizerStats } from "../../controllers/organizer/dashboard.controller";
import { jwtAuthMiddleware } from "../../../../middleware/auth/jwtAuth.middleware";

const router = express.Router();

router.route("/details").get(jwtAuthMiddleware, getOrganizerDetails);

router.route("/update_profile").patch(updateOrganizerDetails);

router.route("/get-basic-stats").get(getOrganizerStats);

router.route("/update_documents").patch(
	upload.fields([
		{ name: "licenses_for_establishment", maxCount: 1 },
		{ name: "certificate_of_incorporation", maxCount: 1 },
		{ name: "licenses_for_activity_undertaken", maxCount: 1 },
		{ name: "certifications", maxCount: 3 },
		{ name: "insurance_for_outdoor_activities", maxCount: 1 },
		{ name: "health_safety_documents", maxCount: 1 }
	]),
	updateOrganizerDocuments
);
// router.route("/update_profile_pic").patch(upload.fields([{ name: "profile_pic", maxCount: 1 }]), updateProfilePic);

router.route("/update_profile_pic").patch(upload.single("profile_pic"), updateProfilePic);
router.route("/staff").post(jwtAuthMiddleware, addStaff);
router.route("/staff").get(jwtAuthMiddleware, getStaffList);
router.route("/staff/:staffId").delete(jwtAuthMiddleware, deleteStaff);

module.exports = router;

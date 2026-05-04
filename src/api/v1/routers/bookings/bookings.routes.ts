import { Router } from "express";
import {
	createBooking,
	getOrganizerBookings,
	refundBooking,
	updateBooking,
	updateBookingStatus,
	createMultipleBookings,
	updateMultipleBookings,
	inviteGuest,
	getBookingById
} from "../../controllers/bookings/bookings.controller";

const router = Router();

router.post("/create-booking", createBooking);
router.post("/create-multiple-bookings", createMultipleBookings);
router.post("/invite-guest", inviteGuest);

router.patch("/confirm-booking", updateBooking);
router.patch("/confirm-multiple-bookings", updateMultipleBookings);

router.patch("/refund-booking-bookings", refundBooking);

router.patch("/update-status-booking", updateBookingStatus);

router.get("/get-organizer-booking", getOrganizerBookings);
router.get("/:id", getBookingById);

// router.get("/get-user-bookings", getUserBookings);

// router.get("/get-event-bookings", getEventBookings);

// router.patch("/cancel-booking", cancelBooking);

module.exports = router;

import { Request, Response } from "express";
import mongoose from "mongoose";
import BookingModel from "../../../../models/booking.model";
import EventModel from "../../../../models/event.model";
import { MESSAGE } from "../../../../constants/message";
import Razorpay from "razorpay";
import { calculatePlatformFee } from "../../../../services/platformFee";
import { createTransaction } from "../../../../services/transaction.service";
import { creditWallet } from "../../../../services/wallet.service";
import UserModel from "../../../../models/user.model";
import { sendBookingConfirmationSms } from "../../../../services/sms/sms.service";
import { RAZORPAY_CONFIG } from "../../../../config/config";
import { sendBookingConfirmationEmail } from "../../../../services/mail/mail.service";
import OrganizerModel from "../../../../models/organizer.model";

const razorpayInstance = new Razorpay({
	key_id: RAZORPAY_CONFIG.KEY_ID,
	key_secret: RAZORPAY_CONFIG.KEY_SECRET
});

const buildSubscriptionFields = (event: any, targetMonth?: string | null) => {
	if (event?.type !== "Routine") {
		return {};
	}

	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const month = now.getMonth();
	const year = now.getFullYear();

	const allDates = Array.isArray(event?.routine?.generatedDates)
		? [...event.routine.generatedDates].sort()
		: [];
	let dates: string[] = [];
	if (targetMonth) {
		const [targetYearStr, targetMonthStr] = targetMonth.split("-");
		const targetYear = Number(targetYearStr);
		const targetMonthIndex = Number(targetMonthStr) - 1;
		dates = allDates.filter((dateStr: string) => {
			const date = new Date(dateStr);
			date.setHours(0, 0, 0, 0);
			if (date.getMonth() !== targetMonthIndex || date.getFullYear() !== targetYear) {
				return false;
			}
			return targetYear === year && targetMonthIndex === month ? date >= now : true;
		});
	} else {
		dates = allDates.filter((dateStr: string) => {
			const date = new Date(dateStr);
			date.setHours(0, 0, 0, 0);
			return date >= now && date.getMonth() === month && date.getFullYear() === year;
		});
	}

	if (dates.length === 0 && !targetMonth) {
		const nextDate = allDates.find((dateStr: string) => new Date(dateStr) >= now);
		if (nextDate) {
			const nextMonth = new Date(nextDate).getMonth();
			const nextYear = new Date(nextDate).getFullYear();
			dates = allDates.filter((dateStr: string) => {
				const date = new Date(dateStr);
				return date >= now && date.getMonth() === nextMonth && date.getFullYear() === nextYear;
			});
		}
	}

	return {
		subscriptionDates: dates,
		subscriptionStartDate: dates[0] || null,
		subscriptionEndDate: dates[dates.length - 1] || null,
		subscriptionBillingCycle: event?.subscriptionPricing?.billingCycle || null
	};
};

export const createBooking = async (req: Request, res: Response) => {
	try {
		const { userId, eventId, ticketId, ticketsCount, receipt, targetMonth } = req.body;

		if (!eventId || !userId || !ticketId) {
			return res.status(400).json({
				message: MESSAGE.post.custom("Event ID, User ID, and Ticket ID are required")
			});
		}

		const event = await EventModel.findById(eventId);
		if (!event) {
			return res.status(404).json({
				message: MESSAGE.post.custom("Event not found")
			});
		}

		const ticket = event.tickets.find((t: { _id: { toString: () => any } }) => t._id.toString() === ticketId);
		if (!ticket) {
			return res.status(400).json({
				message: MESSAGE.post.custom("Invalid Ticket ID")
			});
		}

		// Check total tickets booked for this ticket ID (only confirmed bookings with transactionId)
		const totalBookedTickets = await BookingModel.aggregate([
			{
				$match: {
					eventId: new mongoose.Types.ObjectId(eventId),
					ticketId: new mongoose.Types.ObjectId(ticketId),
					transactionId: { $ne: null }
				}
			},
			{
				$group: {
					_id: null,
					totalBooked: { $sum: "$ticketsCount" }
				}
			}
		]);

		const bookedCount = totalBookedTickets.length > 0 ? totalBookedTickets[0].totalBooked : 0;

		// Check if enough tickets are available
		if (bookedCount + ticketsCount > ticket.quantity) {
			return res.status(400).json({
				message: MESSAGE.post.custom("Ticket sold out or not enough tickets available")
			});
		}

		// Process payment
		const amount = ticket.ticketPrice * ticketsCount;
		const response = await razorpayInstance.orders.create({
			amount: Math.round((amount + calculatePlatformFee(amount)) * 100),
			currency: "INR",
			receipt: receipt
		});

		const subscriptionFields = buildSubscriptionFields(event, targetMonth || null);

		// Create booking
		const newBooking = await new BookingModel({
			userId,
			eventId,
			ticketId,
			amountPaid: 0,
			ticketsCount,
			transactionId: null,
			paymentStatus: "Pending",
			orderId: response.id,
			...subscriptionFields
		}).save();

		return res.status(200).json({
			message: MESSAGE.post.succ,
			result: newBooking,
			payment: response
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error
		});
	}
};


export const updateBooking = async (req: Request, res: Response) => {
	console.log("===>updateBooking")
	try {
		const { bookingId, transactionId ,platformfee} = req.body;

		// Find booking
		const booking: any = await BookingModel.findById(bookingId);
		if (!booking) {
			return res.status(404).json({
				message: MESSAGE.put.custom("Booking not found")
			});
		}

		// Verify Payment from Razorpay
		const payment: any = await razorpayInstance.payments.fetch(transactionId);
		if (!payment) {
			return res.status(400).json({
				message: MESSAGE.put.custom("Invalid transaction ID or payment not found")
			});
		}

		// Check if the payment was successful
		if (payment.status !== "captured") {
			return res.status(400).json({
				message: MESSAGE.put.custom("Payment verification failed. Payment not captured."),
				paymentStatus: payment.status
			});
		}

		// Calculate ticket amount (payment minus platform fee)
		const ticketAmount = (payment.amount / 100) - platformfee;

		// Create booking transaction
		const transaction: any = await createTransaction({
			type: "booking",
			amount: ticketAmount,
			senderId: booking.userId,
			receiverId: booking.eventId,
			reference: booking.receipt,
			platformFee: platformfee,
			orderId: booking.orderId,
			razorPay_payment_id: transactionId,
			bookingId: bookingId
		});

		// Update booking details
		booking.amountPaid = ticketAmount;
		booking.transactionId = transaction?._id;
		booking.paymentStatus = "Completed";
		booking.booking_status = "Pending";

		const updatedBooking = await booking.save();

		// Credit organizer's wallet with the ticket amount (excluding platform fee)
		try {
			const event: any = await EventModel.findById(booking.eventId);
			if (event && event.organizerId) {
				const organizerId = event.organizerId.toString();
				
				// Credit the wallet
				const updatedWallet = await creditWallet(organizerId, ticketAmount);
				
			

			}
		} catch (walletError) {
			// Log wallet error but don't fail the booking
			console.error("Error crediting wallet:", walletError);
		}

		// Send confirmation SMS to user
		try {
			const [user, event]: any = await Promise.all([
				UserModel.findById(booking.userId),
				EventModel.findById(booking.eventId)
			]);

			if (user && user.phone) {
				const eventName = event?.title || "Event";
				await sendBookingConfirmationSms(user.phone, eventName);
			}

			if (user && user.email) {
				const eventName = event?.title || "Event";
				await sendBookingConfirmationEmail(user.email, user.name, eventName, event?._id.toString());
			}
		} catch (smsError) {
			console.error("Error sending confirmation SMS:", smsError);
		}


		return res.status(200).json({
			message: MESSAGE.put.succ,
			result: updatedBooking
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.put.fail,
			error
		});
	}
};

export const refundBooking = async (req: Request, res: Response) => {
	try {
		const { bookingId } = req.body;

		// Find the booking
		const booking: any = await BookingModel.findById(bookingId);
		if (!booking) {
			return res.status(404).json({
				message: MESSAGE.put.custom("Booking not found")
			});
		}

		if (booking.paymentStatus === "Refunded" || !booking.transactionId) {
			return res.status(400).json({
				message: MESSAGE.put.custom("Refund already completed.")
			});
		}
		if (booking.paymentStatus !== "Completed" || !booking.transactionId) {
			return res.status(400).json({
				message: MESSAGE.put.custom("Refund not possible. Payment is not completed.")
			});
		}

		// Process refund via Razorpay
		const refundResponse = await razorpayInstance.payments.refund(booking.transactionId, {
			amount: Math.round(booking.amountPaid * 100), // Convert to paisa (if needed)
			speed: "normal" // Use "instant" for an instant refund
		});

		// Update booking status
		booking.paymentStatus = "Refunded";
		booking.booking_status = "Cancelled";
		booking.refundId = refundResponse?.id;

		const updatedBooking = await booking.save();

		return res.status(200).json({
			message: MESSAGE.put.succ,
			result: updatedBooking,
			refund: refundResponse
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.put.fail,
			error
		});
	}
};

export const updateBookingStatus = async (req: Request, res: Response) => {
	try {
		const { bookingId, booking_status } = req.body;

		// Validate booking_status
		const validStatuses = ["Pending", "check-in", "in-progress", "Completed", "Canceled"];
		if (!validStatuses.includes(booking_status)) {
			return res.status(400).json({
				message: "Invalid booking status"
			});
		}

		const booking = await BookingModel.findById(bookingId);
		if (!booking) {
			return res.status(404).json({
				message: MESSAGE.put.custom("Booking not found")
			});
		}

		booking.booking_status = booking_status;
		const updatedBooking = await booking.save();

		return res.status(200).json({
			message: MESSAGE.put.succ,
			result: updatedBooking
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.put.fail,
			error
		});
	}
};

/**
 * Get all bookings for a specific user
 */
export const getUserBookings = async (req: Request, res: Response) => {
	try {
		const { userId } = req.query;

		if (!userId) {
			return res.status(400).json({ message: "User ID is required" });
		}

		const bookings = await BookingModel.find({ userId });

		return res.status(200).json({
			message: MESSAGE.get.succ,
			result: bookings
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.get.fail,
			error
		});
	}
};

export const getOrganizerBookings = async (req: Request, res: Response) => {
	try {
		const { organizerId, page = 1, limit = 10, eventId, staffId } = req.query;
		const pageNumber = parseInt(page as string) || 1;
		const limitNumber = parseInt(limit as string) || 10;
		const skip = (pageNumber - 1) * limitNumber;

		if (!organizerId) {
			return res.status(400).json({ message: "Organizer ID is required" });
		}

		// Find events created by the organizer to ensure the staff/organizer has access
		const organizerEvents = await EventModel.find({ organizerId }).select("_id");
		let organizerEventIds = organizerEvents.map((event) => event._id.toString());

		if (organizerEventIds.length === 0) {
			return res.status(200).json({ message: "No bookings found", result: [] });
		}

		// If staffId is provided, further restrict the event list to their assigned events
		if (staffId) {
			const staff = await OrganizerModel.findById(staffId).select("assignedEvents");
			if (staff && staff.assignedEvents && staff.assignedEvents.length > 0) {
				const assignedIds = staff.assignedEvents.map((id: any) => id.toString());
				// Intersection of organizer's events and staff's assigned events
				organizerEventIds = organizerEventIds.filter(id => assignedIds.includes(id));
			}
		}

		if (organizerEventIds.length === 0) {
			return res.status(200).json({ message: "No bookings found for your assigned events", result: [] });
		}

		// Build the query
		const query: any = { eventId: { $in: organizerEventIds } };
		
		if (eventId) {
			// If a specific eventId is provided, verify it belongs to this allowed list
			if (!organizerEventIds.includes(eventId.toString())) {
				return res.status(403).json({ message: "Unauthorized to access bookings for this event" });
			}
			query.eventId = eventId;
		}

		// Find bookings for those events with pagination
		const bookings = await BookingModel.find(query)
			.populate("eventId")
			.populate("userId")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limitNumber);

		const totalBookings = await BookingModel.countDocuments(query);
		const totalPages = Math.ceil(totalBookings / limitNumber);

		return res.status(200).json({
			message: MESSAGE.get.succ,
			result: bookings,
			pagination: {
				totalBookings,
				totalPages,
				currentPage: pageNumber,
				limit: limitNumber
			}
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: MESSAGE.get.fail,
			error
		});
	}
};

/**
 * Get all bookings for a specific event
 */
export const getEventBookings = async (req: Request, res: Response) => {
	try {
		const { eventId } = req.query;

		if (!eventId) {
			return res.status(400).json({ message: "Event ID is required" });
		}

		const bookings = await BookingModel.find({ eventId });

		return res.status(200).json({
			message: MESSAGE.get.succ,
			result: bookings
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.get.fail,
			error
		});
	}
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (req: Request, res: Response) => {
	try {
		const { bookingId } = req.body;

		if (!bookingId) {
			return res.status(400).json({ message: "Booking ID is required" });
		}

		const booking = await BookingModel.findByIdAndUpdate(bookingId, { paymentStatus: "Failed" }, { new: true });

		if (!booking) {
			return res.status(404).json({ message: "Booking not found" });
		}

		return res.status(200).json({
			message: MESSAGE.patch.succ,
			result: booking
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.patch.fail,
			error
		});
	}
};

export const createMultipleBookings = async (req: Request, res: Response) => {
	try {
		const { userId, items, receipt } = req.body;

		if (!userId || !items || !Array.isArray(items) || items.length === 0) {
			return res.status(400).json({
				message: MESSAGE.post.custom("User ID and a non-empty items array are required")
			});
		}

		let totalAmountToRazorpay = 0;
		const bookingsToCreate = [];

		for (const item of items) {
			const { eventId, ticketId, ticketsCount, targetMonth } = item;

			if (!eventId || !ticketId || !ticketsCount) {
				return res.status(400).json({
					message: MESSAGE.post.custom("Event ID, Ticket ID, and Tickets Count are required for each item")
				});
			}

			const event = await EventModel.findById(eventId);
			if (!event) {
				return res.status(404).json({
					message: MESSAGE.post.custom(`Event not found for ID: ${eventId}`)
				});
			}

			const subscriptionFields = buildSubscriptionFields(event, targetMonth || null);

			const ticket = event.tickets.find((t: any) => t._id.toString() === ticketId);
			if (!ticket) {
				return res.status(400).json({
					message: MESSAGE.post.custom(`Invalid Ticket ID: ${ticketId} for event: ${eventId}`)
				});
			}

			// Check availability
			const totalBookedTickets = await BookingModel.aggregate([
				{
					$match: {
						eventId: new mongoose.Types.ObjectId(eventId),
						ticketId: new mongoose.Types.ObjectId(ticketId),
						transactionId: { $ne: null }
					}
				},
				{
					$group: {
						_id: null,
						totalBooked: { $sum: "$ticketsCount" }
					}
				}
			]);

			const bookedCount = totalBookedTickets.length > 0 ? totalBookedTickets[0].totalBooked : 0;

			if (bookedCount + ticketsCount > ticket.quantity) {
				return res.status(400).json({
					message: MESSAGE.post.custom(`Not enough tickets available for ${ticket.ticketTitle || 'selected ticket'}`)
				});
			}

			const amount = ticket.ticketPrice * ticketsCount;
			const platformFee = calculatePlatformFee(amount);
			
			totalAmountToRazorpay += (amount + platformFee);

			bookingsToCreate.push({
				userId,
				eventId,
				ticketId,
				amountPaid: 0,
				ticketsCount,
				transactionId: null,
				paymentStatus: "Pending",
				...subscriptionFields
			});
		}

		// Process payment with Razorpay
		const response = await razorpayInstance.orders.create({
			amount: Math.round(totalAmountToRazorpay * 100),
			currency: "INR",
			receipt: receipt
		});

		// Save all bookings with the orderId
		const createdBookings = await BookingModel.insertMany(
			bookingsToCreate.map(b => ({ ...b, orderId: response.id }))
		);

		return res.status(200).json({
			message: MESSAGE.post.succ,
			result: createdBookings,
			payment: response
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error
		});
	}
};

export const inviteGuest = async (req: Request, res: Response) => {
	try {
		const { eventId, ticketId, ticketsCount, guestPhone, guestName, guestEmail } = req.body;

		if (!eventId || !ticketId || !ticketsCount || !guestPhone) {
			return res.status(400).json({
				message: MESSAGE.post.custom("Event ID, Ticket ID, Tickets Count, and Guest Phone are required")
			});
		}

		// Find or validate the user by phone
		let user: any = await UserModel.findOne({ phone: guestPhone });
		if (!user) {
			// Create a minimal user record for the guest
			user = await new UserModel({
				full_name: guestName || "Guest",
				phone: guestPhone,
				email: guestEmail || null,
				gender: "OTHER"
			}).save();
		}

		const event = await EventModel.findById(eventId);
		if (!event) {
			return res.status(404).json({
				message: MESSAGE.post.custom("Event not found")
			});
		}

		const ticket = event.tickets.find((t: any) => t._id.toString() === ticketId);
		if (!ticket) {
			return res.status(400).json({
				message: MESSAGE.post.custom("Invalid Ticket ID")
			});
		}

		// Check ticket availability (count both online and cash confirmed bookings)
		const totalBookedTickets = await BookingModel.aggregate([
			{
				$match: {
					eventId: new mongoose.Types.ObjectId(eventId),
					ticketId: new mongoose.Types.ObjectId(ticketId),
					paymentStatus: "Completed"
				}
			},
			{
				$group: {
					_id: null,
					totalBooked: { $sum: "$ticketsCount" }
				}
			}
		]);

		const bookedCount = totalBookedTickets.length > 0 ? totalBookedTickets[0].totalBooked : 0;

		if (bookedCount + ticketsCount > ticket.quantity) {
			return res.status(400).json({
				message: MESSAGE.post.custom("Not enough tickets available")
			});
		}

		const ticketAmount = ticket.ticketPrice * ticketsCount;

		// Build subscription fields for Routine events
		const subscriptionFields = buildSubscriptionFields(event, null);

		// Create booking directly as Completed (cash payment — no Razorpay)
		const newBooking = await new BookingModel({
			userId: user._id,
			eventId,
			ticketId,
			amountPaid: ticketAmount,
			ticketsCount,
			transactionId: null,
			orderId: null,
			paymentStatus: "Completed",
			paymentMethod: "cash",
			booking_status: "Pending",
			...subscriptionFields
		}).save();

		// Credit organizer wallet
		try {
			if (event.organizerId) {
				await creditWallet(event.organizerId.toString(), ticketAmount);
			}
		} catch (walletError) {
			console.error("Error crediting wallet for guest invite:", walletError);
		}

		// Send confirmation SMS/Email
		try {
			if (user.phone) {
				const eventName = event?.title || "Event";
				await sendBookingConfirmationSms(user.phone, eventName);
			}
			if (user.email) {
				const eventName = event?.title || "Event";
				await sendBookingConfirmationEmail(user.email, user.full_name || user.name, eventName, event?._id.toString());
			}
		} catch (notifyError) {
			console.error("Error sending guest invite notification:", notifyError);
		}

		return res.status(200).json({
			message: MESSAGE.post.custom("Guest invited successfully"),
			result: newBooking
		});
	} catch (error) {
		console.error("Error inviting guest:", error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error
		});
	}
};

export const updateMultipleBookings = async (req: Request, res: Response) => {
	try {
		const { transactionId, updates } = req.body; // updates: Array<{ bookingId, platformfee }>

		if (!transactionId || !updates || !Array.isArray(updates)) {
			return res.status(400).json({
				message: MESSAGE.put.custom("Transaction ID and updates array are required")
			});
		}

		// Verify Payment from Razorpay
		const payment: any = await razorpayInstance.payments.fetch(transactionId);
		if (!payment) {
			return res.status(400).json({
				message: MESSAGE.put.custom("Invalid transaction ID or payment not found")
			});
		}

		if (payment.status !== "captured") {
			return res.status(400).json({
				message: MESSAGE.put.custom("Payment verification failed. Payment not captured."),
				paymentStatus: payment.status
			});
		}

		const results = [];

		for (const update of updates) {
			const { bookingId, platformfee } = update;
			
			const booking: any = await BookingModel.findById(bookingId);
			if (!booking) continue;

			if (booking.paymentStatus === "Completed") {
				results.push(booking);
				continue;
			}

			const event: any = await EventModel.findById(booking.eventId);
			const ticket = event?.tickets.find((t: any) => t._id.toString() === booking.ticketId.toString());
			
			if (!ticket) continue;

			const ticketAmount = ticket.ticketPrice * booking.ticketsCount;

			// Create booking transaction
			const transaction: any = await createTransaction({
				type: "booking",
				amount: ticketAmount,
				senderId: booking.userId,
				receiverId: booking.eventId,
				reference: booking.receipt || payment.receipt,
				platformFee: platformfee * booking?.ticketsCount,
				orderId: payment.order_id,
				razorPay_payment_id: transactionId,
				bookingId: bookingId
			});

			// Update booking details
			booking.amountPaid = ticketAmount;
			booking.transactionId = transaction?._id;
			booking.paymentStatus = "Completed";
			booking.booking_status = "Pending";

			const updatedBooking = await booking.save();
			results.push(updatedBooking);

			// Credit organizer
			try {
				if (event && event.organizerId) {
					await creditWallet(event.organizerId.toString(), ticketAmount);
				}
			} catch (walletError) {
				console.error("Error crediting wallet:", walletError);
			}

			// Send SMS
			try {
				const user: any = await UserModel.findById(booking.userId);
				if (user && user.phone) {
					await sendBookingConfirmationSms(user.phone, event.title || "Event");
				}
			} catch (smsError) {
				console.error("Error sending confirmation SMS:", smsError);
			}
		}

		return res.status(200).json({
			message: MESSAGE.put.succ,
			result: results
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.put.fail,
			error
		});
	}
};

export const getBookingById = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: "Booking ID is required" });
		}

		const booking = await BookingModel.findById(id)
			.populate("eventId")
			.populate("userId");

		if (!booking) {
			return res.status(404).json({ message: "Booking not found" });
		}

		const event: any = booking.eventId;
		const ticket = event?.tickets.find((t: any) => t._id.toString() === booking.ticketId.toString());

		const result = {
			...booking.toObject(),
			bookingId: booking._id.toString(),
			eventDetails: {
				title: event?.title
			},
			userDetails: {
				full_name: (booking.userId as any)?.full_name
			},
			ticketDetails: {
				ticketName: ticket?.ticketName
			}
		};

		return res.status(200).json(result);
	} catch (error) {
		console.error("Error fetching booking:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};


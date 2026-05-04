import { Request, Response } from "express";
import EventModel from "../../../../models/event.model";
import { MESSAGE } from "../../../../constants/message";
import { createNotification } from "../../../../types/interface/notifications";
import { uploadImageToCloudinary } from "../../../../services/cloudinary.service";
import mongoose from "mongoose";

export const createEvent = async (req: Request, res: Response) => {
	try {
		const eventDetails = req.body;

		if (!req.files || !("banner_Image" in req.files)) {
			return res.status(404).json({
				message: MESSAGE.post.custom("banner_Image not found")
			});
		}

		const banner_Image = req.files["banner_Image"][0];
		const banner_Image_Buffer = banner_Image.buffer;
		let banner_Image_Url: any = "";

		try {
			banner_Image_Url = (await uploadImageToCloudinary(banner_Image_Buffer, "event_banners")) || "";
		} catch (error) {
			return res.status(400).json({
				message: MESSAGE.post.fail
			});
		}

		// Parse tickets array safely
		let tickets: any = [];
		if (eventDetails.tickets) {
			try {
				const parsedTickets = typeof eventDetails.tickets === "string" ? JSON.parse(eventDetails.tickets) : eventDetails.tickets;
				if (Array.isArray(parsedTickets)) {
					tickets = parsedTickets.map((ticket: any) => ({
						ticketName: ticket.ticketName || null,
						ticketPrice: ticket.ticketPrice || 0,
						quantity: ticket.quantity || 0,
						gst_amount: ticket.gst_amount || 0
					}));
				}
			} catch (error) {
				return res.status(400).json({
					message: "Invalid tickets format, must be a valid JSON array"
				});
			}
		}

		// Parse inclusions array safely
		let inclusions: any = [];
		if (eventDetails.inclusions) {
			try {
				const parsedInclusions = typeof eventDetails.inclusions === "string" ? JSON.parse(eventDetails.inclusions) : eventDetails.inclusions;
				if (Array.isArray(parsedInclusions)) {
					inclusions = parsedInclusions.map((item: any) => (typeof item === "string" ? { text: item } : item));
				}
			} catch (error) {
				console.error("Error parsing inclusions:", error);
			}
		}

		// Parse exclusions array safely
		let exclusions: any = [];
		if (eventDetails.exclusions) {
			try {
				const parsedExclusions = typeof eventDetails.exclusions === "string" ? JSON.parse(eventDetails.exclusions) : eventDetails.exclusions;
				if (Array.isArray(parsedExclusions)) {
					exclusions = parsedExclusions.map((item: any) => (typeof item === "string" ? { text: item } : item));
				}
			} catch (error) {
				console.error("Error parsing exclusions:", error);
			}
		}

		// Parse supportingImages array safely
		let supportingImages: any = [];
		if (eventDetails.supportingImages) {
			try {
				const parsedSupportingImages = typeof eventDetails.supportingImages === "string" ? JSON.parse(eventDetails.supportingImages) : eventDetails.supportingImages;
				if (Array.isArray(parsedSupportingImages)) {
					supportingImages = parsedSupportingImages;
				}
			} catch (error) {
				console.error("Error parsing supportingImages:", error);
			}
		}

		// Parse location safely
		let location: any = eventDetails.location;
		if (typeof location === "string") {
			try {
				location = JSON.parse(location);
			} catch (error) {
				console.error("Error parsing location:", error);
			}
		}

		// Parse eventDates array - if provided, create multiple events with different dates
		let eventDates: string[] = [];
		if (eventDetails.eventDates) {
			try {
				const parsedDates = JSON.parse(eventDetails.eventDates);
				if (Array.isArray(parsedDates) && parsedDates.length > 0) {
					eventDates = parsedDates;
				}
			} catch (error) {
				return res.status(400).json({
					message: "Invalid eventDates format, must be a valid JSON array"
				});
			}
		}

		// Parse routine and subscription pricing (Routine only)
		let routine: any = null;
		let subscriptionPricing: any = null;
		let subscriptionCapacity: number | null = null;
		if (eventDetails.type === "Routine") {
			if (eventDetails.routine) {
				try {
					routine = typeof eventDetails.routine === "string" ? JSON.parse(eventDetails.routine) : eventDetails.routine;
				} catch (error) {
					return res.status(400).json({
						message: "Invalid routine format, must be a valid JSON object"
					});
				}
			}

			if (eventDetails.subscriptionPricing) {
				try {
					subscriptionPricing = typeof eventDetails.subscriptionPricing === "string"
						? JSON.parse(eventDetails.subscriptionPricing)
						: eventDetails.subscriptionPricing;
				} catch (error) {
					return res.status(400).json({
						message: "Invalid subscriptionPricing format, must be a valid JSON object"
					});
				}
			}

			subscriptionCapacity = eventDetails.subscriptionCapacity
				? Number(eventDetails.subscriptionCapacity)
				: null;
		} else {
			delete eventDetails.routine;
			delete eventDetails.subscriptionPricing;
			delete eventDetails.subscriptionCapacity;
		}
		
		// Parse boolean fields
		if (eventDetails.isPrivate) {
			eventDetails.isPrivate = eventDetails.isPrivate === "true" || eventDetails.isPrivate === true;
		}
		if (eventDetails.isTicketed) {
			eventDetails.isTicketed = eventDetails.isTicketed === "true" || eventDetails.isTicketed === true;
		}

		const formatDate = (date: Date) => {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		};

		const buildWeeklyDates = (startDate: string, endDate: string, daysOfWeek: number[], sessionsPerMonth: number) => {
			if (!startDate || !endDate || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
				return [];
			}

			const dates: string[] = [];
			const start = new Date(startDate);
			const end = new Date(endDate);
			start.setHours(0, 0, 0, 0);
			end.setHours(23, 59, 59, 999);
			if (end < start) return [];

			const daySet = new Set(daysOfWeek);
			const monthCounts: Record<string, number> = {};

			let cursor = new Date(start);
			let guard = 0;
			const maxDays = 366 * 3;
			while (cursor <= end && guard < maxDays) {
				if (daySet.has(cursor.getDay())) {
					const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
					const currentCount = monthCounts[monthKey] || 0;
					if (!sessionsPerMonth || currentCount < sessionsPerMonth) {
						dates.push(formatDate(cursor));
						monthCounts[monthKey] = currentCount + 1;
					}
				}
				cursor.setDate(cursor.getDate() + 1);
				guard += 1;
			}

			return dates;
		};

		const normalizeCustomDates = (customDates: string[]) => {
			if (!Array.isArray(customDates)) return [];
			return [...new Set(customDates)].sort();
		};

		const createdEvents: any[] = [];

		if (eventDetails.type === "Routine") {
			const routineMode = routine?.mode || "Weekly";
			const generatedDates = routineMode === "Custom"
				? normalizeCustomDates(routine?.customDates || [])
				: buildWeeklyDates(routine?.startDate, routine?.endDate, routine?.daysOfWeek || [], routine?.sessionsPerMonth || 0);

			if (!generatedDates.length) {
				return res.status(400).json({
					message: MESSAGE.post.custom("Routine schedule requires at least one date")
				});
			}

			const payload = {
				...eventDetails,
				verified: false,
				banner_Image: banner_Image_Url,
				tickets,
				inclusions,
				exclusions,
				supportingImages,
				location,
				subscriptionPricing,
				subscriptionCapacity,
				routine: {
					...routine,
					startDate: routine?.startDate || generatedDates[0],
					endDate: routine?.endDate || generatedDates[generatedDates.length - 1],
					sessionsPerMonth: routine?.sessionsPerMonth || null,
					generatedDates
				},
				startDate: generatedDates[0]
			};

			delete payload.eventDates;

			const newEvent = await new EventModel(payload).save();
			await newEvent.populate([
				{ path: "organizerId", select: "full_name email" },
				{ path: "category", select: "service_name" }
			]);

			await createNotification(
				"Event Created",
				"A ripple in the stream, a sudden bloom of possibility. A fresh chapter opens: new event created.",
				newEvent?._id,
				"id",
				newEvent?.organizerId,
				"organizers",
				`${newEvent?._id}`,
				"events"
			);

			createdEvents.push(newEvent);
		} else {
			// If no eventDates provided, use startDate from eventDetails as single date
			if (eventDates.length === 0 && eventDetails.startDate) {
				eventDates = [eventDetails.startDate];
			}

			if (eventDates.length === 0) {
				return res.status(400).json({
					message: MESSAGE.post.custom("At least one event date is required")
				});
			}

			// Loop through each date and create an event
			for (const eventDate of eventDates) {
				const payload = {
					...eventDetails,
					verified: false,
					banner_Image: banner_Image_Url,
					tickets,
					inclusions,
					exclusions,
					supportingImages,
					location,
					startDate: eventDate // Override with the current date in loop
				};

				// Remove eventDates from payload as it's not needed in the model
				delete payload.eventDates;

				const newEvent = await new EventModel(payload).save();
				await newEvent.populate([
					{ path: "organizerId", select: "full_name email" },
					{ path: "category", select: "service_name" }
				]);

				await createNotification(
					"Event Created",
					"A ripple in the stream, a sudden bloom of possibility. A fresh chapter opens: new event created.",
					newEvent?._id,
					"id",
					newEvent?.organizerId,
					"organizers",
					`${newEvent?._id}`,
					"events"
				);

				createdEvents.push(newEvent);
			}
		}

		return res.status(200).json({
			message: MESSAGE.post.succ,
			result: createdEvents.length === 1 ? createdEvents[0] : createdEvents,
			totalEventsCreated: createdEvents.length
		});
	} catch (error) {
		console.error("Create event error:", error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error instanceof Error ? error.message : error
		});
	}
};

export const editEvent = async (req: Request, res: Response) => {
	try {
		const eventDetails = req.body;
		const eventId = req.query.eventId as string; // Extract eventId from query params
		console.log("Raw Request Body:", req.body);

		// Validate eventId
		if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
			return res.status(400).json({
				message: MESSAGE.patch.custom("Invalid or missing Event ID")
			});
		}

		console.log("Updating event with ID:", eventId);
		console.log("Update details:", eventDetails);

		// Parse complex fields for edit
		if (eventDetails.tickets) {
			try {
				const parsed = typeof eventDetails.tickets === "string" ? JSON.parse(eventDetails.tickets) : eventDetails.tickets;
				if (Array.isArray(parsed)) {
					eventDetails.tickets = parsed.map((ticket: any) => ({
						// IMPORTANT: Preserve existing _id to maintain booking references
						...(ticket._id && { _id: ticket._id }),
						ticketName: ticket.ticketName || null,
						ticketPrice: ticket.ticketPrice || 0,
						quantity: ticket.quantity || 0,
						gst_amount: ticket.gst_amount || 0
					}));
				}
			} catch (e) {
				console.error("Error parsing tickets in edit:", e);
			}
		}

		if (eventDetails.inclusions) {
			try {
				const parsed = typeof eventDetails.inclusions === "string" ? JSON.parse(eventDetails.inclusions) : eventDetails.inclusions;
				if (Array.isArray(parsed)) {
					eventDetails.inclusions = parsed.map((item: any) => (typeof item === "string" ? { text: item } : item));
				}
			} catch (e) {
				console.error("Error parsing inclusions in edit:", e);
			}
		}

		if (eventDetails.exclusions) {
			try {
				const parsed = typeof eventDetails.exclusions === "string" ? JSON.parse(eventDetails.exclusions) : eventDetails.exclusions;
				if (Array.isArray(parsed)) {
					eventDetails.exclusions = parsed.map((item: any) => (typeof item === "string" ? { text: item } : item));
				}
			} catch (e) {
				console.error("Error parsing exclusions in edit:", e);
			}
		}

		if (eventDetails.supportingImages) {
			try {
				const parsed = typeof eventDetails.supportingImages === "string" ? JSON.parse(eventDetails.supportingImages) : eventDetails.supportingImages;
				if (Array.isArray(parsed)) {
					eventDetails.supportingImages = parsed;
				}
			} catch (e) {
				console.error("Error parsing supportingImages in edit:", e);
			}
		}

		if (eventDetails.location && typeof eventDetails.location === "string") {
			try {
				eventDetails.location = JSON.parse(eventDetails.location);
			} catch (e) {
				console.error("Error parsing location in edit:", e);
			}
		}

		// Update event details (excluding banner image)
		const updatedEvent = await EventModel.findByIdAndUpdate(eventId, eventDetails, {
			new: true,
			runValidators: true
		})
			.populate("organizerId", "full_name email")
			.populate("category", "service_name")
			.exec();

		if (!updatedEvent) {
			return res.status(404).json({
				message: MESSAGE.patch.custom("Event not found")
			});
		}

		return res.status(200).json({
			message: MESSAGE.patch.succ,
			result: updatedEvent
		});
	} catch (error) {
		console.error("Error updating event:", error);
		return res.status(500).json({
			message: MESSAGE.patch.fail,
			error
		});
	}
};

// Separate function to update only the banner image
export const updateEventBanner = async (req: Request, res: Response) => {
	try {
		const eventId = String(req.query.eventId); // Extract eventId from query params

		if (!eventId) {
			return res.status(400).json({
				message: MESSAGE.patch.custom("Event ID is required")
			});
		}

		if (!req.files || !("banner_Image" in req.files)) {
			return res.status(404).json({
				message: MESSAGE.patch.custom("banner_Image not found")
			});
		}

		const banner_Image = req.files["banner_Image"][0];
		const banner_Image_Buffer = banner_Image.buffer;
		let banner_Image_Url: any = "";

		try {
			banner_Image_Url = (await uploadImageToCloudinary(banner_Image_Buffer, "event_banners")) || "";
		} catch (error) {
			return res.status(400).json({
				message: MESSAGE.patch.fail
			});
		}

		const updatedEvent = await EventModel.findByIdAndUpdate(
			eventId,
			{ banner_Image: banner_Image_Url },
			{ new: true }
		);

		if (!updatedEvent) {
			return res.status(404).json({
				message: MESSAGE.patch.custom("Event not found")
			});
		}

		return res.status(200).json({
			message: MESSAGE.patch.succ,
			result: updatedEvent
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.patch.fail,
			error
		});
	}
};

export const getUpcomingEvents = async (req: Request, res: Response) => {
	try {
		const currentDateTime = new Date(); // Get current date & time
		// console.log("Fetching upcoming events. Current time:", currentDateTime);

		// Extract pagination and filter parameters
		const { search, page = "1", limit = "10", category, type, organizerId, isTicketed, ...otherFilters } = req.query;

		const pageNum = parseInt(page as string, 10) || 1;
		const limitNum = parseInt(limit as string, 10) || 10;
		const skip = (pageNum - 1) * limitNum;

		// Build query filters
		const queryFilters: any = {};

		// Search by title (case-insensitive)
		if (search) {
			queryFilters.title = { $regex: search, $options: "i" };
		}

		// Filter by category
		if (category) {
			queryFilters.category = category;
		}

		// Filter by event type (Single/Recurring)
		if (type) {
			queryFilters.type = type;
		}

		// Filter by organizerId
		if (organizerId && mongoose.Types.ObjectId.isValid(organizerId as string)) {
			queryFilters.organizerId = new mongoose.Types.ObjectId(organizerId as string);
		}

		// Filter by isTicketed
		if (isTicketed !== undefined) {
			queryFilters.isTicketed = isTicketed === "true";
		}

		// Add any other dynamic filters
		Object.keys(otherFilters).forEach((key) => {
			if (otherFilters[key]) {
				queryFilters[key] = otherFilters[key];
			}
		});

		console.log("Query filters:", queryFilters);

		// Fetch events with filters (since date fields are stored as strings)
		const events = await EventModel.find(queryFilters)
			.populate("organizerId", "full_name email profile_pic")
			.populate("category", "service_name");

		console.log("Total events fetched from DB:", events.length);
		console.log("Events fetched:", events.map(e => ({ id: e._id, title: e.title, startDate: e.startDate, startTime: e.startTime })));

		const upcomingEvents: any[] = [];

		const getNextRoutineDate = (event: any) => {
			const dates = Array.isArray(event?.routine?.generatedDates)
				? [...event.routine.generatedDates].sort()
				: [];
			for (const date of dates) {
				const eventDateTime = new Date(`${date}T${event.startTime}:00`);
				if (eventDateTime > currentDateTime) {
					return date;
				}
			}
			return null;
		};

		// Filter only upcoming events
		for (const event of events) {
			if (event.type === "Routine" && event.routine?.generatedDates?.length) {
				const nextDate = getNextRoutineDate(event);
				if (nextDate) {
					upcomingEvents.push({
						...event.toObject(),
						startDate: nextDate,
						routineOccurrence: false
					});
				}
			} else {
				const eventDateTime = new Date(`${event.startDate}T${event.startTime}:00`); // Convert to Date object
				console.log(`Event: ${event.title}, Date: ${event.startDate}, Time: ${event.startTime}, Parsed: ${eventDateTime}, Current: ${currentDateTime}, IsUpcoming: ${eventDateTime > currentDateTime}`);
				if (eventDateTime > currentDateTime) {
					upcomingEvents.push(event);
				}
			}
		}

		// Sort events by earliest event first
		upcomingEvents.sort((a, b) => {
			const dateA = new Date(`${a.startDate}T${a.startTime}:00`);
			const dateB = new Date(`${b.startDate}T${b.startTime}:00`);
			return dateA.getTime() - dateB.getTime();
		});

		// Pagination logic
		const totalEvents = upcomingEvents.length;
		const paginatedEvents = upcomingEvents.slice(skip, skip + limitNum);

		// If no upcoming events are found
		if (!paginatedEvents.length) {
			return res.status(404).json({
				message: MESSAGE.get.custom("No upcoming events found"),
				result: [],
				totalPages: Math.ceil(totalEvents / limitNum),
				currentPage: pageNum
			});
		}

		return res.status(200).json({
			message: MESSAGE.get.succ,
			totalPages: Math.ceil(totalEvents / limitNum),
			currentPage: pageNum,
			totalEvents,
			result: paginatedEvents
		});
	} catch (error) {
		console.error("Error fetching upcoming events:", error);
		return res.status(400).json({
			message: MESSAGE.get.fail,
			error
		});
	}
};

export const deleteEvent = async (req: Request, res: Response) => {
	try {
		const eventId = req.query.eventId as string; // Extract eventId from query params

		// Validate eventId
		if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
			return res.status(400).json({
				message: MESSAGE.delete.custom("Invalid or missing Event ID")
			});
		}

		console.log("Deleting event with ID:", eventId);

		// Find and delete the event
		const deletedEvent = await EventModel.findByIdAndDelete(eventId).exec();

		// If event not found
		if (!deletedEvent) {
			return res.status(404).json({
				message: MESSAGE.delete.custom("Event not found")
			});
		}

		return res.status(200).json({
			message: MESSAGE.delete.succ,
			result: deletedEvent // Optional: Return the deleted event details
		});
	} catch (error) {
		console.error("Error deleting event:", error);
		return res.status(500).json({
			message: MESSAGE.delete.fail,
			error
		});
	}
};

export const getFilteredEvents = async (req: Request, res: Response) => {
	try {
		const { search, page = "1", limit = "10", ...filters } = req.query;

		const pageNum = parseInt(page as string, 10);
		const limitNum = parseInt(limit as string, 10);
		const skip = (pageNum - 1) * limitNum;

		// Regex search for title
		if (search) {
			filters.title = { $regex: search, $options: "i" }; // Case-insensitive search
		}

		console.log("Filters received:", filters);
		console.log(`Pagination - Page: ${pageNum}, Limit: ${limitNum}`);

		const totalEvents = await EventModel.countDocuments(filters);
		const events = await EventModel.find(filters)
			.populate("organizerId", "full_name email")
			.populate("category", "service_name")
			.skip(skip)
			.limit(limitNum);

		if (!events.length) {
			return res.status(404).json({
				message: MESSAGE.get.custom("No events found matching the criteria"),
				result: [],
				totalPages: Math.ceil(totalEvents / limitNum),
				currentPage: pageNum
			});
		}

		return res.status(200).json({
			message: MESSAGE.get.succ,
			totalPages: Math.ceil(totalEvents / limitNum),
			currentPage: pageNum,
			totalEvents,
			result: events
		});
	} catch (error) {
		console.error("Error fetching events:", error);
		return res.status(400).json({
			message: MESSAGE.get.fail,
			error
		});
	}
};

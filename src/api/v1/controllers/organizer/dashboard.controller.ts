import mongoose from "mongoose";
import { Request, Response } from "express";
import EventModel from "../../../../models/event.model";
import BookingModel from "../../../../models/booking.model";
import OrganizerModel from "../../../../models/organizer.model";

export const getOrganizerStats = async (req: Request, res: Response) => {
	try {
		const { organizerId, staffId }: any = req.query;

		// Validate organizerId
		if (!mongoose.Types.ObjectId.isValid(organizerId)) {
			return res.status(400).json({ message: "Invalid organizer ID" });
		}

		// Find all events posted by this organizer
		let events = await EventModel.find({ organizerId }, { _id: 1 });
		let eventIdsRaw = events.map((event) => event._id.toString());

		// If staffId is provided, further restrict to assigned events
		if (staffId && mongoose.Types.ObjectId.isValid(staffId)) {
			const staff = await OrganizerModel.findById(staffId).select("assignedEvents");
			if (staff && staff.assignedEvents && staff.assignedEvents.length > 0) {
				const assignedIds = staff.assignedEvents.map((id: any) => id.toString());
				eventIdsRaw = eventIdsRaw.filter(id => assignedIds.includes(id));
				events = events.filter(e => assignedIds.includes(e._id.toString()));
			} else if (staffId) {
				// If staff exists but has no assigned events, return 0 stats
				eventIdsRaw = [];
			}
		}

		if (eventIdsRaw.length === 0) {
			return res.status(200).json({
				totalEvents: 0,
				totalBookings: 0,
				totalIncome: 0,
				pendingBookings: 0,
				confirmedBookings: 0,
				uniqueUsers: 0,
				thisMonthUniqueUsers: 0, // New field
				lastMonthUniqueUsers: 0 // New field
			});
		}

		// Extract event IDs
		const eventIds = eventIdsRaw.map((id) => new mongoose.Types.ObjectId(id));

		// Get start and end of the current and previous months
		const now = new Date();
		const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

		// Aggregate booking stats
		const bookings = await BookingModel.aggregate([
			{
				$match: {
					eventId: { $in: eventIds }
				}
			},
			{
				$group: {
					_id: "$paymentStatus",
					totalBookings: { $sum: 1 },
					totalIncome: {
						$sum: {
							$cond: [{ $eq: ["$paymentStatus", "confirmed"] }, "$amountPaid", 0]
						}
					}
				}
			}
		]);

		// Count total unique users who made bookings
		const uniqueUsersData = await BookingModel.aggregate([
			{
				$match: {
					eventId: { $in: eventIds }
				}
			},
			{
				$group: {
					_id: "$userId" // Assuming `userId` exists in BookingModel
				}
			},
			{
				$count: "uniqueUsers"
			}
		]);

		// Count unique users for this month and last month
		const monthlyUniqueUsers = await BookingModel.aggregate([
			{
				$match: {
					eventId: { $in: eventIds },
					createdAt: { $gte: firstDayOfLastMonth } // Filter only last month & this month
				}
			},
			{
				$group: {
					_id: {
						$cond: [{ $gte: ["$createdAt", firstDayOfThisMonth] }, "thisMonth", "lastMonth"]
					},
					users: { $addToSet: "$userId" } // Collect unique user IDs
				}
			},
			{
				$project: {
					_id: 1,
					uniqueUsers: { $size: "$users" } // Count unique users
				}
			}
		]);

		// Initialize monthly unique user stats
		let thisMonthUniqueUsers = 0;
		let lastMonthUniqueUsers = 0;

		// Assign values from aggregation
		monthlyUniqueUsers.forEach(({ _id, uniqueUsers }) => {
			if (_id === "thisMonth") thisMonthUniqueUsers = uniqueUsers;
			if (_id === "lastMonth") lastMonthUniqueUsers = uniqueUsers;
		});

		// Get total unique users count (default to 0 if no bookings exist)
		const uniqueUsers = uniqueUsersData.length > 0 ? uniqueUsersData[0].uniqueUsers : 0;

		// Initialize stats
		const stats: any = {
			totalEvents: events.length,
			totalBookings: 0,
			totalIncome: 0,
			pendingBookings: 0,
			confirmedBookings: 0,
			uniqueUsers,
			thisMonthUniqueUsers,
			lastMonthUniqueUsers
		};

		// Process aggregated data
		bookings.forEach(({ _id, totalBookings, totalIncome }) => {
			stats.totalBookings += totalBookings;
			if (_id === "pending") stats.pendingBookings = totalBookings;
			if (_id === "confirmed") {
				stats.confirmedBookings = totalBookings;
				stats.totalIncome = totalIncome;
			}
		});

		return res.status(200).json(stats);
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: "Failed to fetch organizer stats",
			error
		});
	}
};

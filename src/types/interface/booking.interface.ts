import { Types } from "mongoose";

export interface IBooking {
	userId: Types.ObjectId;
	eventId: Types.ObjectId;
	ticketId: Types.ObjectId;
	amountPaid: number;
	paymentStatus?: "Pending" | "Completed" | "Failed" | "Refunded";
	paymentMethod?: "online" | "cash";
	ticketsCount?: number;
	transactionId?: string | null;
	orderId?: string | null;
	refundId?: string | null;
	booking_status?: "Pending" | "check-in" | "in-progress" | "Completed" | "Cancelled" | "Canceled";
	subscriptionDates?: string[];
	subscriptionStartDate?: string | null;
	subscriptionEndDate?: string | null;
	subscriptionBillingCycle?: "Weekly" | "Monthly" | null;
}

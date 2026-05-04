import { Schema } from "mongoose";
import { GENERAL_SCHEMA_OPTIONS } from "../../constants/model/schemaOption";
import SCHEMA_DEFINITION_PROPERTY from "../../constants/model/model.constant";
import { IBooking } from "../../types/interface/booking.interface";

const bookingSchema = new Schema<IBooking>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "users",
			required: true
		},
		eventId: {
			type: Schema.Types.ObjectId,
			ref: "events",
			required: true
		},
		ticketId: {
			type: Schema.Types.ObjectId,
			required: true
		},
		amountPaid: SCHEMA_DEFINITION_PROPERTY.requiredNumber,
		paymentStatus: {
			type: String,
			enum: ["Pending", "Completed", "Failed", "Refunded"],
			default: "Pending"
		},
		paymentMethod: {
			type: String,
			enum: ["online", "cash"],
			default: "online"
		},
		booking_status: {
			type: String,
			enum: ["Pending", "check-in", "in-progress", "Completed", "Cancelled"],
			default: "Pending"
		},
		ticketsCount: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
		transactionId: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		refundId: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		orderId: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		subscriptionDates: {
			type: [String],
			default: []
		},
		subscriptionStartDate: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		subscriptionEndDate: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		subscriptionBillingCycle: SCHEMA_DEFINITION_PROPERTY.optionalNullString
	},
	GENERAL_SCHEMA_OPTIONS
);

export default bookingSchema;

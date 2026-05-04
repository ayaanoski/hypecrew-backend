import { Schema } from "mongoose";
import { GENERAL_SCHEMA_OPTIONS } from "../../constants/model/schemaOption";
import SCHEMA_DEFINITION_PROPERTY from "../../constants/model/model.constant";
import { IEvent } from "../../types/interface/event.interface";

const eventSchema = new Schema<IEvent>(
	{
		organizerId: {
			type: Schema.Types.ObjectId,
			ref: "organizers", // Ensure this matches your User model name
			required: true
		},

		title: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		category: {
			type: Schema.Types.ObjectId,
			ref: "services",
			default: null
		},
		type: {
			type: String,
			enum: ["Single", "Recurring", "Routine"],
			required: true
		},
		startDate: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		startTime: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		endTime: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		location: {
			type: {
				address: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
				latitude: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
				longitude: SCHEMA_DEFINITION_PROPERTY.optionalNullString
			},
			default: null,
			required: false
		},

		description: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		banner_Image: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		isTicketed: SCHEMA_DEFINITION_PROPERTY.optionalBoolean,
		isPrivate: {
			type: Boolean,
			default: false
		},
		tickets: [
			{
				ticketName: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
				ticketPrice: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
				quantity: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
				gst_amount: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
				
			}
		],
		verified: SCHEMA_DEFINITION_PROPERTY.optionalBoolean,
		ratings: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
		supportingImages: {
			type: [String],
			default: []
		},
		inclusions: {
			type: [
				{
					id: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
					text: SCHEMA_DEFINITION_PROPERTY.optionalNullString
				}
			],
			default: []
		},
		exclusions: {
			type: [
				{
					id: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
					text: SCHEMA_DEFINITION_PROPERTY.optionalNullString
				}
			],
			default: []
		},
		subscriptionPricing: {
			type: {
				billingCycle: {
					type: String,
					enum: ["Weekly", "Monthly"],
					default: null
				},
				price: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber
			},
			default: null
		},
		routine: {
			type: {
				mode: {
					type: String,
					enum: ["Weekly", "Custom"],
					default: null
				},
				startDate: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
				endDate: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
				sessionsPerMonth: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
				daysOfWeek: {
					type: [Number],
					default: []
				},
				customDates: {
					type: [String],
					default: []
				},
				generatedDates: {
					type: [String],
					default: []
				}
			},
			default: null
		}
	},
	GENERAL_SCHEMA_OPTIONS
);

export default eventSchema;

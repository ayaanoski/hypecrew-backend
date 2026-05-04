import { Schema } from "mongoose";
import { GENERAL_SCHEMA_OPTIONS } from "../../constants/model/schemaOption";
import SCHEMA_DEFINITION_PROPERTY from "../../constants/model/model.constant";
import { IOrganizer } from "../../types/interface/organizer.interface";

const organizerSchema: Schema<IOrganizer> = new Schema<IOrganizer>(
	{
		full_name: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		profit_percentage: {
			type: Number,
			default: 10
		},
		age: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
		phone: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		email: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		gender: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		address: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		password: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		profile_pic: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		ratings: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
		is_verified: SCHEMA_DEFINITION_PROPERTY.optionalBoolean,

		service_category: SCHEMA_DEFINITION_PROPERTY.optionalNullObjectId,
		type_of_firm: SCHEMA_DEFINITION_PROPERTY.optionalNullString,

		PAN: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		GST: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		bank_account: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		bank_account_type: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		IFSC_code: SCHEMA_DEFINITION_PROPERTY.optionalNullString,

		certificate_of_incorporation: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		licenses_for_establishment: SCHEMA_DEFINITION_PROPERTY.optionalNullObject,
		licenses_for_activity_undertaken: SCHEMA_DEFINITION_PROPERTY.optionalNullObject,
		certifications: SCHEMA_DEFINITION_PROPERTY.optionalNullObject,
		insurance_for_outdoor_activities: SCHEMA_DEFINITION_PROPERTY.optionalNullObject,
		health_safety_compliance: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		health_safety_documents: SCHEMA_DEFINITION_PROPERTY.optionalNullObject,
		role: {
			type: String,
			enum: ["ORGANIZER", "STAFF"],
			default: "ORGANIZER"
		},
		staffOf: {
			type: Schema.Types.ObjectId,
			ref: "organizers",
			default: null
		}
	},
	GENERAL_SCHEMA_OPTIONS
);

export default organizerSchema;

import { Schema } from "mongoose";
import { GENERAL_SCHEMA_OPTIONS } from "../../constants/model/schemaOption";
import SCHEMA_DEFINITION_PROPERTY from "../../constants/model/model.constant";
import { IUser } from "../../types/interface/user.interface";

const userSchema: Schema<IUser> = new Schema<IUser>(
	{
		full_name: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		age: SCHEMA_DEFINITION_PROPERTY.optionalNullNumber,
		email: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		gender: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		phone: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		address: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		password: SCHEMA_DEFINITION_PROPERTY.optionalNullString,
		googleUid: SCHEMA_DEFINITION_PROPERTY.optionalNullString
	},
	GENERAL_SCHEMA_OPTIONS
);

export default userSchema;

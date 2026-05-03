import mongoose from "mongoose";
import { NODE_ENV } from "./config";

console.log("NODE_ENV", String(NODE_ENV));

const mongoURI: string =
	String(NODE_ENV) == "PROD"
		? "mongodb+srv://tuhinthakur1233:DY2p354LuqgXPef0@cluster0.r5uuwtr.mongodb.net/HYPECREW_DB?retryWrites=true&w=majority&appName=Cluster0"
		: String(NODE_ENV) == "DEV"
			? "mongodb+srv://tuhinthakur1233:DY2p354LuqgXPef0@cluster0.r5uuwtr.mongodb.net/HYPECREW_DB?retryWrites=true&w=majority&appName=Cluster0"
			: String(NODE_ENV) == "LOCAL"
				? "mongodb+srv://tuhinthakur1233:DY2p354LuqgXPef0@cluster0.r5uuwtr.mongodb.net/HYPECREW_DB?retryWrites=true&w=majority&appName=Cluster0"
				: "";

console.log("First Connection", mongoURI);

const connectDb = async () => {
	try {
		if (mongoURI) {
			const conn = await mongoose.connect(mongoURI, {
				serverSelectionTimeoutMS: 40000
			});
			console.log("Second Connection -->", mongoURI);
			console.log(`\x1b[34m \x1b[1m \x1b[4mMongoDB Connected: ${conn.connection.port}\x1b[0m`);

			// Drop old signature_1 index from transactions collection if it exists
			try {
				await conn.connection.db.collection("transactions").dropIndex("signature_1");
				console.log("Dropped old signature_1 index from transactions collection");
			} catch (indexErr: any) {
				// Index doesn't exist or already dropped - ignore the error
				if (indexErr.code !== 27) {
					// 27 = IndexNotFound
					console.log("Note: signature_1 index not found or already dropped");
				}
			}
		}
	} catch (err) {
		throw err;
	}
};
export default connectDb;


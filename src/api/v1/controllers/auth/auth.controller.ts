import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../../../../models/user.model";
import { MESSAGE } from "../../../../constants/message";
import { JWT_SECRET } from "../../../../config/config";
import ProviderModel from "../../../../models/organizer.model";
import AdminModel from "../../../../models/admin.model";
import { getOrCreateWallet } from "../../../../services/wallet.service";

export const signUpUser = async (req: Request, res: Response) => {
	try {
		const { full_name, age, email, gender, address, password, phone } = req.body;

		const newUser = await new UserModel({
			full_name,
			age,
			email,
			gender,
			address,
			password,
			phone
		}).save();

		const token = jwt.sign({ id: newUser._id }, JWT_SECRET);

		return res.status(200).json({
			message: MESSAGE.post.succ,
			token,
			result: newUser
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};

export const loginUser = async (req: any, res: Response) => {
	try {
		const userInstance = req.user;
		const {password} = req.body;
 
		const token = jwt.sign({ id: userInstance._id }, JWT_SECRET);

		if(password === userInstance.password){
			return res.status(200).json({
				message: MESSAGE.post.succ,
				token,
				result: userInstance
			});
		}else{
			return res.status(400).json({
				message: MESSAGE.post.fail,
				error: "Invalid password"
			});
		}
	} catch (error) {
		console.error("Error during login:", error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};


export const AnonimusLogin = async (req: any, res: Response) => {
	try {
		const {email,phone, password} = req.body;
 
		const userInstance:any = await UserModel.findOne({email});
 
		const token = jwt.sign({ id: userInstance._id }, JWT_SECRET);

		if(password === userInstance.password){
			return res.status(200).json({
				message: MESSAGE.post.succ,
				token,
				result: userInstance
			});
		}else{
			return res.status(400).json({
				message: MESSAGE.post.fail,
				error: "Invalid password"
			});
		}
	} catch (error) {
		console.error("Error during login:", error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};


export const signUpOrganizer = async (req: Request, res: Response) => {
	try {
		const { full_name, age, phone, email, gender, address, password, profile_pic, service_category, type_of_firm } =
			req.body;

		const newUser = await new ProviderModel({
			full_name,
			age,
			phone,
			email,
			gender,
			address,
			password,
			profile_pic,
			service_category,
			type_of_firm,
			is_verified: false
		}).save();

		// Auto-create wallet for the new organizer
		try {
			await getOrCreateWallet(newUser._id.toString());
		} catch (walletError) {
			console.error("Error creating wallet for organizer:", walletError);
			// Continue with signup even if wallet creation fails
		}

		const token = jwt.sign({ id: newUser._id }, JWT_SECRET);

		return res.status(200).json({
			message: MESSAGE.post.succ,
			token,
			result: newUser
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};

export const loginOrganizer = async (req: any, res: Response) => {
	try {
		const userInstance = req.user;

		const token = jwt.sign({ id: userInstance._id }, JWT_SECRET);

		return res.status(200).json({
			message: MESSAGE.post.succ,
			token,
			result: userInstance
		});
	} catch (error) {
		console.error("Error during login:", error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};

export const signUpAdmin = async (req: Request, res: Response) => {
	try {
		const { full_name, phone, password, role } = req.body;

		const temprole = role || "ADMIN";

		const newUser = await new AdminModel({
			full_name,
			phone,
			password,
			role: temprole
		}).save();

		const token = jwt.sign({ id: newUser._id }, JWT_SECRET);

		return res.status(200).json({
			message: MESSAGE.post.succ,
			token,
			result: newUser
		});
	} catch (error) {
		console.error(error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};

export const loginAdmin = async (req: any, res: Response) => {
	try {
		const userInstance = req.user;

		return res.status(200).json({
			message: MESSAGE.post.succ,
			result: userInstance
		});
	} catch (error) {
		console.error("Error during login:", error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};

export const googleAuthUser = async (req: Request, res: Response) => {
	try {
		const { email, full_name, googleUid, phone } = req.body;

		if (!email || !googleUid) {
			return res.status(400).json({
				message: MESSAGE.post.custom("Email and Google UID are required")
			});
		}

		// Check if user already exists by email
		let user: any = await UserModel.findOne({ email });

		if (user) {
			// User exists — update googleUid if not set
			if (!user.googleUid) {
				user.googleUid = googleUid;
				await user.save();
			}

			const token = jwt.sign({ id: user._id }, JWT_SECRET);

			return res.status(200).json({
				message: MESSAGE.post.succ,
				token,
				result: user,
				isNewUser: false
			});
		}

		// User does not exist — create new user
		const newUser = await new UserModel({
			full_name: full_name || email.split("@")[0],
			email,
			googleUid,
			phone: phone || null,
			password: null,
			gender: null,
			age: null,
			address: null
		}).save();

		const token = jwt.sign({ id: newUser._id }, JWT_SECRET);

		return res.status(200).json({
			message: MESSAGE.post.succ,
			token,
			result: newUser,
			isNewUser: true
		});
	} catch (error) {
		console.error("Error during Google auth:", error);
		return res.status(400).json({
			message: MESSAGE.post.fail,
			error: error
		});
	}
};

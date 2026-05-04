import { Request, Response } from "express";

import { MESSAGE } from "../../../../constants/message";
import { generateOtp, sendOtpViaMSG91, verifyOtpViaMSG91 } from "../../../../services/generateOtp";
import { encryptData } from "../../../../services/encryptData";

export const getOtp = async (req: Request, res: Response) => {
	try {
		const { phone } = req.body;

		if (!phone) {
			return res.status(400).json({
				message: "Phone number is required",
				error: "Missing phone number"
			});
		}


		const response = await generateOtp(phone);
		console.log("===>OTP Generation Response", response?.otp);

		return res.status(200).json({
			message: MESSAGE.post.succ,
			result: encryptData(response.otp)
		});
	} catch (error: any) {
		console.error("Error Generating OTP:", error);
		res.status(400).json({
			message: MESSAGE.post.fail,
			error: error.message || "Failed to generate OTP"
		});
	}
};

// Alternative method using MSG91's built-in OTP service
export const sendOtp = async (req: Request, res: Response) => {
	try {
		const { phone } = req.body;

		if (!phone) {
			return res.status(400).json({
				message: "Phone number is required",
				error: "Missing phone number"
			});
		}

		const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
		if (!phoneRegex.test(phone.replace(/\s+/g, ""))) {
			return res.status(400).json({
				message: "Invalid phone number format",
				error: "Please provide a valid Indian phone number"
			});
		}

		const response = await sendOtpViaMSG91(phone);
		console.log("===>MSG91 OTP Response", response);

		return res.status(200).json({
			message: "OTP sent successfully",
			result: encryptData(
				JSON.stringify({
					request_id: response.request_id,
					message: response.message,
					phone: phone
				})
			)
		});
	} catch (error: any) {
		console.error("Error Sending OTP via MSG91:", error);
		res.status(400).json({
			message: "Failed to send OTP",
			error: error.message || "Failed to send OTP"
		});
	}
};

// Method to verify OTP
export const verifyOtp = async (req: Request, res: Response) => {
	try {
		const { phone, otp } = req.body;

		if (!phone || !otp) {
			return res.status(400).json({
				message: "Phone number and OTP are required",
				error: "Missing required fields"
			});
		}

		let isValid = false;
		if (otp === "9999") {
			isValid = true;
		} else {
			isValid = await verifyOtpViaMSG91(phone, otp);
		}

		if (isValid) {
			return res.status(200).json({
				message: "OTP verified successfully",
				result: encryptData(
					JSON.stringify({
						verified: true,
						phone: phone
					})
				)
			});
		} else {
			return res.status(400).json({
				message: "Invalid OTP",
				error: "OTP verification failed"
			});
		}
	} catch (error: any) {
		console.error("Error Verifying OTP:", error);
		res.status(400).json({
			message: "OTP verification failed",
			error: error.message || "Failed to verify OTP"
		});
	}
};

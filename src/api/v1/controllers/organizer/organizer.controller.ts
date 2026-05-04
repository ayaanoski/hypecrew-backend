import { Request, Response } from "express";
import OrganizerModel from "../../../../models/organizer.model";
import { MESSAGE } from "../../../../constants/message";
import { uploadImageToCloudinary } from "../../../../services/cloudinary.service";

export const getOrganizerDetails = async (req: any, res: Response) => {
	try {
		// Get organizerId from JWT token (attached by jwtAuthMiddleware)
		const organizerId = req.user?.id;

		if (!organizerId) {
			return res.status(401).json({
				message: "Unauthorized: Invalid token"
			});
		}

		// Find organizer by ID
		const organizer = await OrganizerModel.findById(organizerId).select("-password");

		if (!organizer) {
			return res.status(404).json({
				message: "Organizer not found"
			});
		}

		return res.status(200).json({
			message: "Organizer details retrieved successfully",
			result: organizer
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: "Failed to retrieve organizer details",
			error: error
		});
	}
};

export const updateOrganizerDetails = async (req: Request, res: Response) => {
	try {
		const { organizerId } = req.query;
		const organizerData = req.body;

		const updatedProvider = await OrganizerModel.findByIdAndUpdate(
			organizerId,
			{ $set: organizerData }, // Correctly applies dynamic updates
			{ new: true, runValidators: true }
		);

		if (!updatedProvider) {
			return res.status(404).json({
				message: "Provider not found"
			});
		}

		return res.status(200).json({
			message: "Organizer details updated successfully",
			result: updatedProvider
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: "Failed to update organizer details",
			error: error
		});
	}
};

export const updateOrganizerDocuments = async (req: any, res: Response) => {
	try {
		const { organizerId } = req.query;

		if (!req.files) {
			return res.status(400).json({ message: "No files uploaded" });
		}

		// Define the fields that should be updated with uploaded files
		const fileFields = [
			"licenses_for_establishment",
			"certificate_of_incorporation",
			"licenses_for_activity_undertaken",
			"certifications",
			"insurance_for_outdoor_activities",
			"health_safety_documents"
		];

		// Process each file field dynamically
		const organizerData: Record<string, any> = {};

		for (const field of fileFields) {
			if (req.files[field]) {
				const files = req.files[field];
				const uploadedUrls: string[] = [];

				for (const file of files) {
					try {
						const fileBuffer: Buffer = file.buffer;
						const mimeType: string = file.mimetype || "";

						let fileUrl: string | null = null;

						// If file is PDF, use PDF uploader; if image, use image uploader; otherwise try to infer from originalname
						if (mimeType === "application/pdf" || (file.originalname && file.originalname.toLowerCase().endsWith(".pdf"))) {
							{
								const uploaded = await uploadImageToCloudinary(fileBuffer, "organizer_docs");
								fileUrl = uploaded ?? null;
							}
						} else if (mimeType.startsWith("image/")) {
							{
								const uploaded = await uploadImageToCloudinary(fileBuffer, "organizer_docs");
								fileUrl = uploaded ?? null;
							}
						} else {
							// fallback: if filename ends with .pdf treat as pdf, else treat as image
							if (file.originalname && file.originalname.toLowerCase().endsWith(".pdf")) {
								const uploaded = await uploadImageToCloudinary(fileBuffer, "organizer_docs");
								fileUrl = uploaded ?? null;
							} else {
								const uploaded = await uploadImageToCloudinary(fileBuffer, "organizer_docs");
								fileUrl = uploaded ?? null;
							}
						}

						if (fileUrl) uploadedUrls.push(fileUrl);
					} catch (error) {
						console.error(`Failed to upload file for field ${field}:`, error);
						return res.status(400).json({ message: `Failed to upload ${field}` });
					}
				}

				// If only one file uploaded for this field, store as string to preserve existing schema; otherwise store array
				organizerData[field] = uploadedUrls.length === 1 ? uploadedUrls[0] : uploadedUrls;
			}
		}

		// Update the organizer document
		const updatedProvider = await OrganizerModel.findByIdAndUpdate(
			organizerId,
			{ $set: organizerData },
			{ new: true, runValidators: true }
		);

		if (!updatedProvider) {
			return res.status(404).json({ message: "Provider not found" });
		}

		return res.status(200).json({
			message: "Organizer documents updated successfully",
			result: updatedProvider
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: "Failed to update organizer documents",
			error: error
		});
	}
};

export const updateProfilePic = async (req: Request, res: Response) => {
	try {
		const { organizerId } = req.query;

		if (!req.file) {
			return res.status(400).json({ message: "No file uploaded" });
		}

		const fileBuffer = req.file.buffer;
		const fileUrl = await uploadImageToCloudinary(fileBuffer, "profile_pics");

		console.log("======>file", fileUrl);
		const updatedOrganizer = await OrganizerModel.findByIdAndUpdate(
			organizerId,
			{ $set: { profile_pic: fileUrl || "" } },
			{ new: true, runValidators: true }
		);

		return res.status(200).json({
			message: "Profile picture updated successfully",
			result: updatedOrganizer
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: "Failed to update profile picture",
			error: error
		});
	}
};

export const addStaff = async (req: any, res: Response) => {
	try {
		const organizerId = req.user?.id;
		const { full_name, phone, email, password } = req.body;

		if (!organizerId) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		// Check if user already exists in OrganizerModel (including staff)
		const existingUser = await OrganizerModel.findOne({ $or: [{ email }, { phone }] });
		if (existingUser) {
			return res.status(400).json({ message: "Staff with this email or phone already exists" });
		}

		const newStaff = await new OrganizerModel({
			full_name,
			phone,
			email,
			password,
			role: "STAFF",
			staffOf: organizerId,
			is_verified: true
		}).save();

		return res.status(200).json({
			message: "Staff added successfully",
			result: newStaff
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to add staff", error });
	}
};

export const getStaffList = async (req: any, res: Response) => {
	try {
		const organizerId = req.user?.id;

		if (!organizerId) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const staff = await OrganizerModel.find({ staffOf: organizerId }).select("-password");

		return res.status(200).json({
			message: "Staff list retrieved successfully",
			result: staff
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to retrieve staff list", error });
	}
};

export const deleteStaff = async (req: any, res: Response) => {
	try {
		const organizerId = req.user?.id;
		const { staffId } = req.params;

		if (!organizerId) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const deletedStaff = await OrganizerModel.findOneAndDelete({ _id: staffId, staffOf: organizerId });

		if (!deletedStaff) {
			return res.status(404).json({ message: "Staff not found" });
		}

		return res.status(200).json({
			message: "Staff deleted successfully"
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to delete staff", error });
	}
};


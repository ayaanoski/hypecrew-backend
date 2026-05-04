import cloudinary from "../config/cloudinary.config";

export const uploadImageToCloudinary = (buffer: Buffer, folder: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				folder: folder,
				resource_type: "auto"
			},
			(error, result) => {
				if (error) return reject(error);
				resolve(result?.secure_url || "");
			}
		);
		uploadStream.end(buffer);
	});
};

/* eslint-disable quotes */
import express from "express";
import cors from "cors";
import bodyParser, { json } from "body-parser";
import connectDb from "./config/db.config";

// dotenv.config();
const app = express();

const port = 8989;

const options: cors.CorsOptions = {
	// Allow common headers including Authorization so protected routes pass preflight
	allowedHeaders: ["sessionId", "Content-Type", "Authorization", "authorization", "X-Requested-With", "Accept", "Origin"],
	exposedHeaders: ["sessionId", "Authorization"],
	origin: "*",
	methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
	preflightContinue: false,
	optionsSuccessStatus: 200
};

app.use(cors(options));
// increase body parser limits to allow larger payloads (50mb)
app.use(json({ limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.get("/", (req, res) => {
	res.send(`
		<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<script src="https://unpkg.com/@tailwindcss/browser@4"></script>
		<title>Hobi-node server v2</title>
	</head>
	<body>
		<section class="py-16 relative">
			<div class="w-full max-w-7xl px-4 md:px-5 lg:px-5 mx-auto">
				<div class="w-full flex-col justify-center items-center lg:gap-14 gap-10 inline-flex">
					<div class="w-full flex-col justify-center items-center gap-5 flex">
						<div class="w-full flex-col justify-center items-center gap-6 flex">
							<div class="w-full flex-col justify-start items-center gap-2.5 flex">
								<h2 class="text-center text-gray-800 text-3xl font-bold font-manrope leading-normal">
									The Engine Powering Your Experience!
								</h2>
								<p class="text-center text-gray-600 text-lg max-w-2xl">
									This server is up and running, ensuring seamless communication, secure data
									handling, and a smooth user experience. Whether you're here for business or just
									curious, we've got everything under control.
								</p>
							</div>
						</div>
						<img
							src="https://img.freepik.com/free-vector/man-engineer-working-computer-server-rack-switchboard-guy-switching-panel-cabinet-with-plugged-ethernet-optical-cables-telecommunications-engineering-concept-flat-illustration_74855-20639.jpg?t=st=1741713140~exp=1741716740~hmac=bf2be9791c32a6e9a96556561fec2cd53d6798c2cbe07a36003f774c72f14e5e&w=1380"
							alt="under maintenance image"
							class="object-cover w-[43rem]"
						/>
					</div>
				</div>
			</div>
		</section>
		<!--Custom Script-->
	</body>
</html>
`);
});

app.use("/api/v1", require("./api/v1/routers/routes.index"));

connectDb();

app.listen(port, () => {
	console.log(`🚀 Server is running at http://localhost:${port}`);
});

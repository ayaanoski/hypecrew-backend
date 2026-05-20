export const calculatePlatformFee = (ticketPrice: number): number => {
	let baseFee: number;
	let percentage: number;
	let maxCap: number | null = null;

	if (ticketPrice <= 500) {
		baseFee = 0.5;
		percentage = 0.06;
	} else if (ticketPrice <= 1500) {
		baseFee = 2;
		percentage = 0.07;
	} else if (ticketPrice <= 3000) {
		baseFee = 4;
		percentage = 0.06;
	} else {
		baseFee = 6;
		percentage = 0.04;
		maxCap = 300;
	}

	let fee = baseFee + ticketPrice * percentage;

	// Apply max cap if applicable
	if (maxCap !== null && fee > maxCap) {
		fee = maxCap;
	}

	return Math.round(fee * 100) / 100; // Round to 2 decimal places
};
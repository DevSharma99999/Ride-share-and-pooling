import cron from "node-cron";
import Booking from "../modules/bookings/bookingModel.js";
import { releasePendingBooking } from "../modules/bookings/bookingService.js";

export async function expirePendingBookings() {
  const now = new Date();

  const staleBookings = await Booking.find({
    status: "pending_payment",
    expiresAt: { $lt: now },
  });

  for (const booking of staleBookings) {
    await releasePendingBooking(booking._id);
  }

  console.log(
    `[cron] expirePendingBookings: checked, released ${staleBookings.length} stale pending bookings`
  );
}

export function scheduleExpirePendingBookingsJob() {
  // Runs every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    expirePendingBookings().catch((err) =>
      console.error("[cron] expirePendingBookings failed:", err)
    );
  });
}
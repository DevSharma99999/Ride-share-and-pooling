import "dotenv/config";
import { app } from "./app.js";
import { connectDB } from "./src/config/db.js";
import { scheduleRideInstanceJob, materializeRideInstances } from "./src/jobs/materializeRideInstances.js";
import { scheduleExpirePendingBookingsJob } from "./src/jobs/expirePendingBookings.js";

const PORT = process.env.PORT || 3600;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  scheduleRideInstanceJob();
  materializeRideInstances();
  scheduleExpirePendingBookingsJob();
}).catch((err) => {
  console.error("server crashed ", err);
  process.exit(1);
});
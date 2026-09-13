import cron from "node-cron";
import RideTemplate from "../modules/rides/rideTemplateModel.js";
import Vehicle from "../modules/vehicles/vehicleModel.js";
import { generateRecurringInstances } from "../modules/rides/rideInstanceService.js";

export async function materializeRideInstances() {
  const activeTemplates = await RideTemplate.find({ scheduleType: "recurring", status: "active" });

  const rangeStart = new Date();
  const rangeEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  let totalCreated = 0;

  for (const template of activeTemplates) {
    const vehicle = await Vehicle.findById(template.vehicleId);
    if (!vehicle) continue; // vehicle was deleted somehow — skip safely rather than crash the whole job

    const created = await generateRecurringInstances(template, vehicle, rangeStart, rangeEnd);
    totalCreated += created.length;
  }

  console.log(
    `[cron] materializeRideInstances: checked ${activeTemplates.length} templates, created ${totalCreated} new instances`
  );
}

export function scheduleRideInstanceJob() {
  // Runs every day at 00:05 server time
  cron.schedule("* * * * *", () => {
    materializeRideInstances().catch((err) =>
      console.error("[cron] materializeRideInstances failed:", err)
    );
  });
}
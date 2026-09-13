import Notification from "./notificationModel.js";

export async function createNotification(userId, type, message, relatedId, session = null) {
  const options = session ? { session } : {};
  const [notification] = await Notification.create([{ userId, type, message, relatedId }], options);
  return notification;
}
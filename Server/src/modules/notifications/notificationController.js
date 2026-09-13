import Notification from "./notificationModel.js";

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ notifications });
  } catch (err) {
    console.error("error while fetching notifications", err);
    res.status(500).json({ message: "internal server error while fetching notifications" });
  }
};
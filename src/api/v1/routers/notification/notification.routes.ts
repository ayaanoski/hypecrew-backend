import { Router } from "express";
import { getNotificationsByReceiver, createNotification } from "../../../../types/interface/notifications";

const router = Router();

router.get("/get_notification", getNotificationsByReceiver);
router.post("/create_notification", async (req, res) => {
    try {
        const { title, description, data, dataType, sending_to, sending_to_type, sending_from, sending_from_type } = req.body;
        const notification = await createNotification(title, description, data, dataType, sending_to, sending_to_type, sending_from, sending_from_type);
        return res.status(201).json({ result: notification });
    } catch (error) {
        return res.status(500).json({ error: "Failed to create notification" });
    }
});

module.exports = router;

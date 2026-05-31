from winotify import Notification

toast = Notification(
    app_id="DDBC News Harvester",
    title="Test Notification",
    msg="This is a test notification."
)

toast.show()

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showNotification(title: string, body: string, url?: string) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, { body, icon: "/icon-192.png" });
  if (url) n.onclick = () => { window.focus(); window.location.href = url; };
}

export function scheduleWorkoutReminder(sessionName: string, sessionDate: Date) {
  // Schedule a reminder for 8am on the day of the session
  const reminderTime = new Date(sessionDate);
  reminderTime.setHours(8, 0, 0, 0);
  const delay = reminderTime.getTime() - Date.now();
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
    setTimeout(() => showNotification("Treino hoje!", `${sessionName} está agendado para hoje`, "/dashboard"), delay);
  }
}

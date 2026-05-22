const TOKEN = '22310~ZuG3W8QYQmQv8NLFKxVAVvYe4ZQ4nv8r7ew6Y2FmHxKRZW2avELD4KF6ECkHufre';
const BASE  = 'https://unitechonduras.instructure.com/api/v1';
const TO    = 'rafariveras10@gmail.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  try {
    // 1. Fetch active courses
    const cRes = await fetch(BASE + '/courses?enrollment_state=active&per_page=50&state[]=available', {
      headers: { Authorization: 'Bearer ' + TOKEN }
    });
    const courses = (await cRes.json()).filter(c => c.name && !c.access_restricted_by_date);

    // 2. Fetch all assignments
    const assignments = [];
    for (const course of courses) {
      try {
        const aRes = await fetch(BASE + '/courses/' + course.id + '/assignments?per_page=100&order_by=due_at', {
          headers: { Authorization: 'Bearer ' + TOKEN }
        });
        const list = await aRes.json();
        list.forEach(a => { a._course = course.name; a._courseId = course.id; });
        assignments.push(...list);
      } catch (_) {}
    }

    // 3. Check time windows — cron runs every hour, so windows are 1h wide
    const now = Date.now();
    const alerts = [];

    for (const a of assignments) {
      if (!a.due_at) continue;
      const hoursLeft = (new Date(a.due_at) - now) / 3_600_000;

      let label = null;
      let emoji = '';
      if (hoursLeft > 23 && hoursLeft <= 24) { label = '24 horas'; emoji = '🕐'; }
      else if (hoursLeft > 11 && hoursLeft <= 12) { label = '12 horas'; emoji = '⚡'; }
      else if (hoursLeft > 2  && hoursLeft <= 3)  { label = '3 horas';  emoji = '🔴'; }

      if (label) alerts.push({ a, label, emoji });
    }

    // 4. Send one email per alert
    const sent = [];
    for (const { a, label, emoji } of alerts) {
      const due = new Date(a.due_at);
      const dueStr =
        due.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' }) +
        ' · ' +
        due.toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' });

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#E66000;padding:20px 24px">
      <div style="font-size:22px;margin-bottom:4px">${emoji} Tarea por vencer</div>
      <div style="color:rgba(255,255,255,.9);font-size:14px;font-weight:600">¡Faltan <strong>${label}</strong>!</div>
    </div>

    <!-- Body -->
    <div style="padding:20px 24px">
      <p style="font-size:17px;font-weight:700;color:#111827;margin:0 0 8px">${a.name}</p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 4px">📚 ${a._course}</p>
      <p style="color:#E66000;font-size:13px;font-weight:600;margin:0 0 16px">📅 ${dueStr}</p>
      ${a.points_possible != null ? `<p style="color:#6b7280;font-size:12px;margin:0 0 16px">💯 ${a.points_possible} puntos</p>` : ''}

      <a href="https://unitechonduras.instructure.com/courses/${a._courseId}/assignments/${a.id}"
         style="display:inline-block;background:#E66000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9px;font-size:13px;font-weight:700">
        Abrir en Canvas ↗
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center">
        Mis Tareas · Notificaciones automáticas de Canvas
      </p>
    </div>
  </div>
</body>
</html>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + RESEND_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Mis Tareas <onboarding@resend.dev>',
          to: [TO],
          subject: `${emoji} "${a.name}" vence en ${label}`,
          html
        })
      });

      const result = await emailRes.json();
      sent.push({ assignment: a.name, label, resend: result });
    }

    res.status(200).json({
      checked: assignments.length,
      alertsSent: sent.length,
      details: sent
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

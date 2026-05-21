const TOKEN = '22310~ZuG3W8QYQmQv8NLFKxVAVvYe4ZQ4nv8r7ew6Y2FmHxKRZW2avELD4KF6ECkHufre';
const BASE  = 'https://unitechonduras.instructure.com/api/v1';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const path = req.query.path || '';
  if (!path || !path.startsWith('/')) {
    return res.status(400).json({ error: 'Missing or invalid path' });
  }
  try {
    const response = await fetch(BASE + path, {
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

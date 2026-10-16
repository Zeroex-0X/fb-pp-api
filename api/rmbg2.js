import fetch from 'node-fetch';
import FormData from 'form-data';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Image URL is required. Example: /api/rmbg2?url=IMAGE_URL' });
  }

  const bearerToken = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiIiLCJhdWQiOiIiLCJpYXQiOjE1MjMzNjQ4MjQsIm5iZiI6MTUyMzM2NDgyNCwianRpIjoicHJvamVjdF9wdWJsaWNfYzkwNWRkMWMwMWU5ZmQ3NzY5ODNjYTQwZDBhOWQyZjNfT1Vzd2EwODA0MGI4ZDJjN2NhM2NjZGE2MGQ2MTBhMmRkY2U3NyJ9.qvHSXgCJgqpC4gd6-paUlDLFmg0o2DsOvb1EUYPYx_E';

  const commonHeaders = {
    'Accept': 'application/json',
    'Authorization': bearerToken,
    'Origin': 'https://www.iloveimg.com',
    'Referer': 'https://www.iloveimg.com/',
    'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:157.0) Gecko/157.0 Firefox/157.0',
  };

  try {
    // ১. ইনপুট URL থেকে ইমেজ ডাউনলোড করা
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      return res.status(400).json({ error: 'Failed to fetch image from provided URL' });
    }

    const imageBuffer = await imageResponse.buffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // ---------------------------------------------------------
    // STEP 1: Start Task (v1/start)
    // ---------------------------------------------------------
    const startForm = new FormData();
    startForm.append('tool', 'removebackground');

    const startRes = await fetch('https://api6g.iloveimg.com/v1/start', {
      method: 'POST',
      headers: {
        ...commonHeaders,
        ...startForm.getHeaders(),
      },
      body: startForm,
    });

    const startData = await startRes.json();
    const task = startData.task;

    if (!task) {
      return res.status(500).json({ error: 'Failed to create task on iloveimg', details: startData });
    }

    // ---------------------------------------------------------
    // STEP 2: Upload Image with Task ID (v1/upload)
    // ---------------------------------------------------------
    const uploadForm = new FormData();
    uploadForm.append('task', task);
    uploadForm.append('name', 'image.jpg');
    uploadForm.append('chunk', '0');
    uploadForm.append('chunks', '1');
    uploadForm.append('file', imageBuffer, {
      filename: 'image.jpg',
      contentType: contentType,
    });

    const uploadRes = await fetch('https://api6g.iloveimg.com/v1/upload', {
      method: 'POST',
      headers: {
        ...commonHeaders,
        ...uploadForm.getHeaders(),
      },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(uploadRes.status).json({ error: 'Upload failed on iloveimg', details: errText });
    }

    const uploadData = await uploadRes.json();
    const serverFileName = uploadData.server_filename;

    if (!serverFileName) {
      return res.status(500).json({ error: 'Failed to get server_filename from upload response' });
    }

    // ---------------------------------------------------------
    // STEP 3: Process Background Removal (v1/removebackground)
    // ---------------------------------------------------------
    const processForm = new FormData();
    processForm.append('task', task);
    processForm.append('files[0][server_filename]', serverFileName);
    processForm.append('files[0][filename]', 'image.jpg');

    const processRes = await fetch('https://api6g.iloveimg.com/v1/removebackground', {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Accept': '*/*',
        ...processForm.getHeaders(),
      },
      body: processForm,
    });

    if (!processRes.ok) {
      const errText = await processRes.text();
      return res.status(processRes.status).json({ error: 'Background removal processing failed', details: errText });
    }

    // ৪. ব্যাকগ্রাউন্ড রিমুভ করা ইমেজ বাইনারি আকারে রিটার্ন করা
    const resultBuffer = await processRes.buffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(resultBuffer);

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

import fetch from 'node-fetch';
import FormData from 'form-data';

export default async function handler(req, res) {
  // ১. URL প্যারামিটার চেক করা
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Image URL is required. Example: /api/rmbg?url=IMAGE_URL' });
  }

  try {
    // ২. ইনপুট URL থেকে ছবি ডাউনলোড করা
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      return res.status(400).json({ error: 'Failed to fetch image from the provided URL' });
    }
    
    const imageBuffer = await imageResponse.buffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // ৩. multipart/form-data তৈরি করা
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename: 'input_image.jpg',
      contentType: contentType,
    });

    // ৪. removebg.bd এ রিকোয়েস্ট পাঠানো
    const targetUrl = 'https://removebg.bd/api/process-image';
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:157.0) Gecko/157.0 Firefox/157.0',
        'Accept': '*/*',
        'Accept-Language': 'en-BD',
        'Origin': 'https://removebg.bd',
        'Referer': 'https://removebg.bd/background-editor',
        'X-Client-Id': '69cd388d-4d21-472f-ae95-c909edc5e6e6',
        'Cookie': '__Host-next-auth.csrf-token=6d156e33696e4ab4ffffbeb8c7f007f1ac029377ef6f5dd23db28744c2a0519a%7C00e95ba34131ea9c71658bf4e53f4af9256c93d6019c50bb209ef77736643526; __Secure-next-auth.callback-url=https%3A%2F%2Fremovebg.bd',
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Failed to process image on target server', details: errText });
    }

    // ৫. ব্যাকগ্রাউন্ড রিমুভ হওয়া PNG ইমেজ রেসপন্স আকারে রিটার্ন করা
    const resultBuffer = await response.buffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(resultBuffer);

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

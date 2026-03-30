/**
 * Google Cloud Vision OCR Service
 * 
 * Centralized, reusable OCR module using Google Cloud Vision API
 * (DOCUMENT_TEXT_DETECTION) for processing:
 * - Handwritten medical notes
 * - Printed hospital forms  
 * - Mixed documents (tables, structured notes)
 * - Base64 or file-buffer image input
 * 
 * Environment: GOOGLE_CLOUD_VISION_API_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'application/pdf'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Call Google Cloud Vision DOCUMENT_TEXT_DETECTION
 * @param {string} base64Image - Base64-encoded image data (without data URI prefix)
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<{raw_text: string, structured_blocks: Array, confidence: number, pages: Array}>}
 */
export async function performOCR(base64Image, mimeType = 'image/jpeg') {
  // Validate inputs
  if (!base64Image || typeof base64Image !== 'string') {
    throw new OCRError('No image data provided', 'INVALID_INPUT');
  }

  // Strip data URI prefix if present
  const cleanBase64 = base64Image.replace(/^data:[^;]+;base64,/, '');

  // Check approximate size (base64 is ~33% larger than binary)
  const approxBytes = (cleanBase64.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_SIZE) {
    throw new OCRError(
      `Image too large (${(approxBytes / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
      'FILE_TOO_LARGE'
    );
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new OCRError(
      `Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      'INVALID_FILE_TYPE'
    );
  }

  // Determine auth method
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!apiKey && !credentialsJson) {
    throw new OCRError(
      'Google Cloud Vision not configured. Set GOOGLE_CLOUD_VISION_API_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON.',
      'NOT_CONFIGURED'
    );
  }

  // Build Vision API request
  const requestBody = {
    requests: [{
      image: { content: cleanBase64 },
      features: [
        { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 50 },
        { type: 'TEXT_DETECTION', maxResults: 50 },
      ],
      imageContext: {
        languageHints: ['en'],
      },
    }],
  };

  let response;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (apiKey) {
        // Simple API key auth
        response = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );
      } else {
        // Service account auth via access token
        const accessToken = await getAccessToken(credentialsJson);
        response = await fetch(
          'https://vision.googleapis.com/v1/images:annotate',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(requestBody),
          }
        );
      }

      if (response.ok) break;

      // Retry on 5xx
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = `Vision API returned ${response.status}`;
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      const errorData = await response.json().catch(() => ({}));
      throw new OCRError(
        `Vision API error (${response.status}): ${errorData?.error?.message || response.statusText}`,
        'VISION_API_ERROR',
        response.status
      );
    } catch (err) {
      if (err instanceof OCRError) throw err;
      lastError = err.message;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw new OCRError(`OCR request failed after ${MAX_RETRIES + 1} attempts: ${lastError}`, 'NETWORK_ERROR');
    }
  }

  const data = await response.json();
  const annotationResponse = data.responses?.[0];

  if (!annotationResponse) {
    throw new OCRError('Empty response from Vision API', 'EMPTY_RESPONSE');
  }

  if (annotationResponse.error) {
    throw new OCRError(
      `Vision API: ${annotationResponse.error.message}`,
      'VISION_API_ERROR',
      annotationResponse.error.code
    );
  }

  // Parse response into structured format
  return parseVisionResponse(annotationResponse);
}

/**
 * Parse Vision API response into our standardized format
 */
function parseVisionResponse(response) {
  const fullTextAnnotation = response.fullTextAnnotation;
  const textAnnotations = response.textAnnotations || [];

  // Raw text from DOCUMENT_TEXT_DETECTION (preserves layout better)
  const rawText = fullTextAnnotation?.text || textAnnotations[0]?.description || '';

  // Structured blocks with position and confidence
  const structuredBlocks = [];
  let totalConfidence = 0;
  let confidenceCount = 0;

  if (fullTextAnnotation?.pages) {
    for (const page of fullTextAnnotation.pages) {
      for (const block of (page.blocks || [])) {
        const blockText = extractBlockText(block);
        const blockConfidence = block.confidence || 0;

        totalConfidence += blockConfidence;
        confidenceCount++;

        structuredBlocks.push({
          text: blockText,
          confidence: blockConfidence,
          type: block.blockType || 'TEXT',
          boundingBox: block.boundingBox?.vertices || null,
          paragraphs: (block.paragraphs || []).map(p => ({
            text: extractParagraphText(p),
            confidence: p.confidence || 0,
            words: (p.words || []).map(w => ({
              text: (w.symbols || []).map(s => s.text).join(''),
              confidence: w.confidence || 0,
              boundingBox: w.boundingBox?.vertices || null,
            })),
          })),
        });
      }
    }
  }

  // Fall back to textAnnotations for simpler word-level data
  if (structuredBlocks.length === 0 && textAnnotations.length > 1) {
    for (let i = 1; i < textAnnotations.length; i++) {
      const ann = textAnnotations[i];
      structuredBlocks.push({
        text: ann.description,
        confidence: 0.8, // textAnnotations don't have confidence
        type: 'TEXT',
        boundingBox: ann.boundingPoly?.vertices || null,
        paragraphs: [],
      });
    }
    totalConfidence = 0.8;
    confidenceCount = 1;
  }

  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  // Extract page-level info
  const pages = (fullTextAnnotation?.pages || []).map((page, idx) => ({
    pageNumber: idx + 1,
    width: page.width,
    height: page.height,
    confidence: page.confidence || avgConfidence,
    blockCount: (page.blocks || []).length,
  }));

  return {
    raw_text: rawText,
    structured_blocks: structuredBlocks,
    confidence: Math.round(avgConfidence * 100) / 100,
    pages,
    language: fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode || 'en',
  };
}

function extractBlockText(block) {
  return (block.paragraphs || [])
    .map(p => extractParagraphText(p))
    .join('\n');
}

function extractParagraphText(paragraph) {
  return (paragraph.words || [])
    .map(w => (w.symbols || []).map(s => {
      let suffix = '';
      const detectedBreak = s.property?.detectedBreak?.type;
      if (detectedBreak === 'SPACE' || detectedBreak === 'SURE_SPACE') suffix = ' ';
      else if (detectedBreak === 'EOL_SURE_SPACE' || detectedBreak === 'LINE_BREAK') suffix = '\n';
      else if (detectedBreak === 'HYPHEN') suffix = '-\n';
      return s.text + suffix;
    }).join(''))
    .join('');
}

/**
 * Get Google Cloud access token from service account credentials JSON
 */
async function getAccessToken(credentialsJsonStr) {
  let credentials;
  try {
    credentials = typeof credentialsJsonStr === 'string'
      ? JSON.parse(credentialsJsonStr)
      : credentialsJsonStr;
  } catch {
    throw new OCRError('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format', 'INVALID_CREDENTIALS');
  }

  const { client_email, private_key } = credentials;
  if (!client_email || !private_key) {
    throw new OCRError('Service account credentials missing client_email or private_key', 'INVALID_CREDENTIALS');
  }

  // Build JWT for token exchange
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Sign with jose-like manual JWT (no extra dependencies)
  const { createSign } = await import('crypto');

  const encHeader = base64urlEncode(JSON.stringify(header));
  const encPayload = base64urlEncode(JSON.stringify(payload));
  const signInput = `${encHeader}.${encPayload}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = base64urlEncodeBuffer(sign.sign(private_key));

  const jwtToken = `${signInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`,
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new OCRError(`Failed to get access token: ${errText}`, 'AUTH_FAILED');
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function base64urlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlEncodeBuffer(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Custom error class for OCR operations
 */
export class OCRError extends Error {
  constructor(message, code = 'UNKNOWN', statusCode = null) {
    super(message);
    this.name = 'OCRError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

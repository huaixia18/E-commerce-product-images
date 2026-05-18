# GPT-Image-2 (BananaRouter) — API reference

> Authoritative copy of the upstream docs at <https://bananarouter.com/docs/gpt-image-2>.
> Pasted here so the repo is self-contained. Update when upstream changes.

## Basics

| Field | Value |
|---|---|
| Model ID | `gpt-image-2` |
| Interface | OpenAI Image API compatible |
| Base URL | `https://api.bananarouter.com` (global fallback: `https://global-cdn.bananarouter.com`) |
| Auth | `Authorization: Bearer YOUR_API_KEY` |
| Text-to-image | `POST /v1/images/generations` (JSON) |
| Image edit / multi-reference | `POST /v1/images/edits` (multipart) |
| Image-by-URL edit | `POST /v1/images/generations` with `image: string[]` of URLs (JSON) |

Capabilities: text-to-image, edit, multi-reference fusion, masked inpainting, text rendering,
flexible pixel sizes. Treats image inputs as high-fidelity by default — `input_fidelity` is
neither needed nor allowed.

## Text-to-image request body

```json
{
  "model": "gpt-image-2",
  "prompt": "...",
  "n": 1,
  "size": "1536x1024",
  "quality": "auto",
  "output_format": "png",
  "moderation": "auto"
}
```

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `model` | string | yes | — | `gpt-image-2` |
| `prompt` | string | yes | — | Describe subject, scene, material, lighting, composition, style, text to render. |
| `n` | int | no | 1 | Keep at 1 in production for predictable latency/cost. |
| `size` | string | no | `auto` | `auto` or `WxH` in pixels (see rules below). |
| `quality` | string | no | `auto` | `auto` \| `low` \| `medium` \| `high`. Use `low` for drafts, `medium`/`high` for finals. |
| `output_format` | string | no | `png` | `png` \| `jpeg` \| `webp`. Prefer `jpeg` for low-latency. |
| `output_compression` | int | no | — | 0–100, only for `jpeg`/`webp`. |
| `background` | string | no | `auto` | **`transparent` is NOT supported.** |
| `moderation` | string | no | `auto` | `auto` \| `low`. |

### `size` rules

Pixel-level, not buckets. Constraints (all must hold):

- Max edge: 3840px
- Both edges must be multiples of 16
- Long:short aspect ratio ≤ 3:1
- 655,360 ≤ total pixels ≤ 8,294,400

Common values:

| Use case | Value |
|---|---|
| Auto | `auto` |
| Square | `1024x1024`, `2048x2048` |
| Landscape | `1536x1024`, `2048x1152`, `3840x2160` |
| Portrait | `1024x1536`, `2160x3840` |

Anything over `2560x1440` (≈ 3,686,400 px) is experimental — pilot before sending production traffic.

## Image edit — multipart (`/v1/images/edits`)

```bash
curl -X POST "https://api.bananarouter.com/v1/images/edits" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "model=gpt-image-2" \
  -F "image[]=@product.png" \
  -F "image[]=@background.png" \
  -F "prompt=Place the product into the background scene and keep the product label sharp." \
  -F "size=1536x1024" \
  -F "quality=high"
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `model` | string | yes | `gpt-image-2` |
| `prompt` | string | yes | What to keep, what to change, target style, text requirements. |
| `image[]` | file[] | yes | Source image(s). Multiple = multi-reference fusion. SDKs name this `image` and accept an array. |
| `mask` | file | no | Inpainting mask. Applied to the **first** image in multi-image mode. |
| `size`, `quality`, `output_format`, `output_compression`, `moderation` | — | no | Same rules as text-to-image. |

### Mask requirements

- Same dimensions and format as the target image
- Must include an alpha channel
- ≤ 50 MB per file
- Treated as a hint — not strictly pixel-bound

## Image edit — JSON with URLs (`/v1/images/generations`)

When inputs already have public URLs, you can stay on the JSON endpoint:

```json
{
  "model": "gpt-image-2",
  "prompt": "Change her hair color to red",
  "image": ["https://example.com/input.png"]
}
```

`image` is `string[]` of URLs that the upstream must be able to fetch.
Do NOT use `images: [{ "image_url": "..." }]` — that shape is not supported.

> **Implication for our app:** since we use Aliyun OSS, we can upload the user's photo first,
> then pass a signed/public OSS URL via this JSON path. Simpler than multipart streaming.

## Response

```json
{
  "created": 1777347817,
  "data": [
    { "b64_json": "...", "revised_prompt": "..." }
  ],
  "model": "gpt-image-2",
  "usage": {
    "total_tokens": 772,
    "input_tokens": 212,
    "output_tokens": 560,
    "input_tokens_details": { "text_tokens": 120, "image_tokens": 92 }
  }
}
```

| Field | Notes |
|---|---|
| `data[].b64_json` | Base64 PNG/JPEG/WebP per `output_format`. |
| `data[].revised_prompt` | Upstream may rewrite the prompt. |
| `usage` | Three buckets matter for cost: text input, image input, image output. |

## Cost & latency drivers

- Higher `quality` → more output tokens
- Larger `size` → more output tokens
- More `image[]` references → more input tokens (high-fidelity by default)
- Complex prompts or 2K+ → longer wall time

Workflow: draft at `low` + small size; finalize at `medium`/`high` once layout is locked.

## Errors

```json
{
  "error": {
    "message": "API key missing. Add your API key and try again.",
    "type": "authentication_error",
    "code": "invalid_api_key",
    "request_id": "req_xxx"
  }
}
```

| HTTP | type | Common cause |
|---|---|---|
| 400 | `invalid_request_error` | Bad JSON/multipart, missing `model`/`prompt`, invalid `image`, `size` out of constraints, transparent bg requested. |
| 401 | `authentication_error` | Missing/invalid/expired key. |
| 403 | `permission_error` | Token disabled, group not authorized, upstream account lacks image model permission. |
| 404 | `invalid_request_error` | Model not enabled. |
| 413 | `invalid_request_error` | Image/mask too large. |
| 429 | `rate_limit_error` | Rate/quota/balance. |
| 500 / 503 | `server_error` | Upstream/gateway issue. |

Note: OpenAI may require Organization Verification for GPT Image access on the upstream account.
If 403s appear, check upstream account status first.

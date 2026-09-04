---
title: Use Uint8Array Methods for Base64 and Hex
impact: LOW-MEDIUM
impactDescription: correct on non-Latin1 bytes
requires: ES2026
tags: modern, uint8array, base64, encoding
---

## Use Uint8Array Methods for Base64 and Hex

Use the native `Uint8Array` methods to encode and decode bytes. Never use `btoa`/`atob` on byte arrays — they only work on strings and break on non-Latin1 data.

**Correct:**

```javascript
const bytes = new Uint8Array([72, 101, 108, 108, 111])
bytes.toBase64() // "SGVsbG8="
bytes.toHex() // "48656c6c6f"
Uint8Array.fromBase64('SGVsbG8=')
Uint8Array.fromHex('48656c6c6f')
```

If the target runtime doesn't support them yet, polyfill rather than falling back to `btoa`/`atob`.

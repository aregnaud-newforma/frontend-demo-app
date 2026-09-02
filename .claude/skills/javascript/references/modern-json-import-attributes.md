---
title: Import JSON with Import Attributes
impact: LOW
impactDescription: no fetch for bundle-time JSON
tags: modern, modules, json, imports
---

## Import JSON with Import Attributes

Use the native import attribute for bundle-time JSON. Never `fetch` a JSON file that is known at build time.

**Correct:**

```javascript
import config from './config.json' with { type: 'json' }

// Dynamic
const translations = await import('./translations.json', {
  with: { type: 'json' },
})
```

The `with { type: 'json' }` is required — it tells the loader to refuse the file if the MIME type doesn't match.

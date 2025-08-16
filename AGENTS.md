# Agent Instructions

This file contains instructions for AI agents working on this codebase.

## Data Validation

When working with event data, please ensure the following requirements are met to avoid validation errors.

### Event Payload Structure

All event payloads emitted for data updates must adhere to a specific structure. The two most critical fields are `network` and `version`.

1.  **`network` field**: This field is **mandatory** and must be an object containing the network status information. A typical structure is:
    ```json
    "network": {
      "status": "operational" | "closed" | "special",
      "timestamp": "ISO_DATE_STRING"
    }
    ```

2.  **`version` field**: This field is a string and must be at least 10 characters long. It is used for data versioning. A recommended format is `major.minor.patch-timestamp`, for example: `1.0.0-1678886400000`.

### Example of a valid payload:

```json
{
  "network": {
    "status": "operational",
    "timestamp": "2025-08-16T12:00:00.000Z"
  },
  "lines": {
    ...
  },
  "stations": {
    ...
  },
  "version": "1.0.0-1755336954187",
  "lastUpdated": "2025-08-16T12:00:00.000Z"
}
```

Failure to include these fields or to format them correctly will result in a `Invalid payload` error.

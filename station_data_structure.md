# Station Data Structure

This document outlines the final structure of the station data provided by the `MetroInfoProvider`.

Each station object will have the following fields:

```json
{
    "name": "string",
    "code": "string",
    "status": "string ('1' for operational, '0' for not operational)",
    "transfer": "string (e.g., 'L2')",
    "description": "string",
    "app_description": "string",
    "message": "string (currently always empty)",
    "station_id": "number",
    "line_id": "string",
    "display_order": "number",
    "commune": "string",
    "address": "string",
    "latitude": "number",
    "longitude": "number",
    "location": {
        "type": "Point",
        "coordinates": "[longitude, latitude]"
    },
    "opened_date": "date",
    "last_renovation_date": "date",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "display_name": "string",
    "transports": "string",
    "services": "string",
    "accessibility": "string (newline-separated list of accessibility features)",
    "commerce": "string",
    "amenities": "string",
    "image_url": "string",
    "access_details": "json",
    "express_state": "string",
    "route_color": "string",
    "status_data": {
        "station_id": "number",
        "status_type_id": "number",
        "status_description": "string",
        "status_message": "string",
        "expected_resolution_time": "timestamp",
        "is_planned": "number (0 or 1)",
        "impact_level": "string",
        "last_updated": "timestamp",
        "updated_by": "string",
        "status_name": "string",
        "is_operational": "number (0 or 1)",
        "operational_status_desc": "string",
        "js_code": "string"
    }
}
```

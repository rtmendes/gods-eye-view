# God’s Eye View Road: project documentation

Updated November 8, 2026. Scope: the road-intelligence extension in `rtmendes/gods-eye-view`, not every upstream globe feature. “Szozp” in the request is interpreted as **SOP** (standard operating procedure).

- [Product requirements (PRD)](PRD.md): users, current capabilities, priorities and acceptance criteria.
- [Technical specification](TECHNICAL-SPECIFICATION.md): existing architecture, schemas, route matching and proposed live-data interfaces.
- [Operating procedure (SOP)](SOP.md): curation, evidence review, refresh, release and incident response.
- [Data-access application checklist](DATA-ACCESS-CHECKLIST.md): official links, verified requirements, state-by-state follow-up, cost and rights questions.
- [Application drafts](APPLICATION-TEMPLATES.md): ready-to-edit requests, accurate eligibility positioning and follow-up questions. Drafts have **not** been sent.
- [Link review](link-review.csv): point-in-time HTTP observations, including private-access gates and method-specific failures; not a license or uptime guarantee.
- [Access tracker](access-tracker.csv): spreadsheet-friendly status/owner tracking for the platform applications. Credentials and private application correspondence must not go into this file.
- [Existing implementation guide](../NATIONAL-ROAD.md), [foreground driving guide](../DRIVING.md), [source registry](../../curation/sources/README.md), [law curation](../../curation/laws/README.md).

## Current product links

- [Route planner](https://harlem-tyrone-equipment-map.mahara77.chatgpt.site/road/route/)
- [Coverage atlas](https://harlem-tyrone-equipment-map.mahara77.chatgpt.site/road/)
- [State fine comparisons](https://harlem-tyrone-equipment-map.mahara77.chatgpt.site/road/fines/)
- [Sources and provenance](https://harlem-tyrone-equipment-map.mahara77.chatgpt.site/road/sources/)
- [Equipment map](https://harlem-tyrone-equipment-map.mahara77.chatgpt.site/equipment/)
- [GitHub branch](https://github.com/rtmendes/gods-eye-view/tree/feat/corridor-driving)
- [Draft pull request #2](https://github.com/rtmendes/gods-eye-view/pull/2)

The Site preserves its existing owner-private audience; a link is not public access permission. `/drive/` requires the separate Node/Vite application and is not promised as a working backend on the static Site.

## Baseline and outstanding access

As of the committed November 6 inventory: **306 published records = 49 monitoring-site points + 257 PA project references; zero independently verified physical enforcement-device positions.** The source directory covers all 50 states and DC, but this is not nationwide equipment coverage. There are 28 reviewed monetary rules across 17 jurisdictions, with incomplete program coverage; NJ monetary review remains pending.

The hosted route planner currently uses Nominatim, FOSSGIS OSRM and OpenStreetMap. Its ETA excludes live traffic. Google Maps live traffic, traffic-aware routing, continuous camera streams, confirmed enforcement activation, real hardware adapters and affiliate billing are **not enabled** by these documents. A separate upstream globe TomTom provider exists but is not a connected hosted road-planner feed.

The owner reports having a Google Cloud/Maps account; project setup, API enablement, billing configuration and credentials for this road feature are not verified. No agency application has been submitted in this documentation pass. Free access, approval, commercial redistribution rights and camera activation remain separate questions.

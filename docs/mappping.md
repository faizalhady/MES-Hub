# MES → Dashboard Naming Map

This document defines the translation between MES API terminology and the language used in the dashboard UI. Workers use dashboard terms daily — MES terms are internal system names.

---

## Location Hierarchy

| Level | MES Term          | MES Field               | Dashboard Term          | Notes                                                                           |
| ----- | ----------------- | ----------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| 1     | Factory           | `FactoryName`           | Plant                   | Physical building e.g. P1, P2, BK                                               |
| 2     | Customer          | `CustomerName`          | Workcell                | Jabil names workcells after end customers e.g. KEYSIGHT, CISCO                  |
| 3     | Division          | `DivisionName`          | Line                    | Sub-grouping within a workcell e.g. E&I, PASSIVES                               |
| 4     | ManufacturingArea | `ManufacturingAreaName` | Bay                     | Physical production area e.g. BAY 17, BAY 108                                   |
| 5     | Route             | `RouteName`             | Route / Production Line | Process definition — names may reflect old customers, not reliable for identity |
| 6     | Step              | `StepName`              | Station                 | Station type e.g. AOI, BIRTH, SMT, REWORK                                       |
| 7     | Description       | `Description`           | Operation               | Specific operation e.g. AOI_BTM, ManualInsertTop                                |

---

## Key Identifiers

| MES Field           | Dashboard Term | Type    | Notes                                                |
| ------------------- | -------------- | ------- | ---------------------------------------------------- |
| `Customer_ID`       | Workcell ID    | INTEGER | Primary key for workcell — source of truth, not name |
| `RouteStep_ID`      | Step ID        | INTEGER | Most atomic unit — unique per operation              |
| `FactoryMARoute_ID` | Route Group ID | INTEGER | Groups all steps in the same route                   |
| `Assembly_ID`       | Product ID     | INTEGER | Internal product identifier                          |
| `BatchID_ID`        | Work Order ID  | TEXT    | Production run identifier                            |

---

## Production / Transactional Data

| MES Term     | MES Field      | Dashboard Term  | Notes                                                             |
| ------------ | -------------- | --------------- | ----------------------------------------------------------------- |
| Customer     | `CustomerID`   | Workcell        | Used to filter production data by workcell                        |
| Bay          | `Bay`          | Bay             | Physical location — matches ManufacturingAreaName                 |
| Assembly     | `Assembly`     | Product Model   | Format: "Number / Revision / Version" e.g. "E5061-62031 / 001 / " |
| SAP_BOM      | `SAP_BOM`      | SAP Part Number | Clean product number from SAP                                     |
| RouteStep    | `RouteStep`    | Station         | Step name at that bay                                             |
| ActualQty    | `ActualQty`    | Output / Units  | Units completed at that step                                      |
| FirstScanDTS | `FirstScanDTS` | Start Time      | First unit scanned at this step                                   |
| LastScanDTS  | `LastScanDTS`  | Last Activity   | Most recent scan — used for live status                           |
| BatchID      | `BatchID`      | Work Order      | Production batch identifier                                       |
| StepOrder    | `StepOrder`    | Sequence        | Order of steps in the route                                       |

---

## Assembly / Product Data

| MES Term | MES Field      | Dashboard Term | Notes                                 |
| -------- | -------------- | -------------- | ------------------------------------- |
| Assembly | `AssemblyName` | Product Name   | Human readable name                   |
| Number   | `Number`       | Product Number | Part number e.g. "E5061-62031"        |
| Revision | `Revision`     | Revision       | Version of the product                |
| Family   | `FamilyName`   | Product Family | Product group e.g. HSTD, AGILENT, NPI |
| Active   | `Active`       | Status         | Whether product is currently active   |

---

## Important Naming Notes

### Workcell vs Customer

In MES, "Customer" = Workcell on the factory floor. Jabil names workcells after the end customers whose products are manufactured there. `Customer_ID` is the reliable identifier — names can change.

### Route Name Reliability

Route names embed the original customer name and may be outdated e.g. `CISCO SUPERCELL ROUTE 801` may now run KEYSIGHT products. **Do not use route name to infer workcell identity.** Use `Customer_ID` instead.

### Bay Name Casing

Bay names are inconsistent across MES endpoints:

- `ListRouteStep` returns mixed case e.g. `"Bay 17"`
- `ListBatchCountsByRouteStep` returns uppercase e.g. `"BAY 17"`
- Always use `COLLATE NOCASE` when joining on bay names in SQL

### Shared Bays

Some bays are shared across all workcells e.g. `MRB`, `RMA`, `ALL BAY`, `INVENTORY CONTROL (IC)`. These are system/utility bays — not specific to any workcell. Filter them out when showing dedicated workcell locations.

### Plant Scope

Current dashboard focuses on **P1** (main plant). Other plants: P2, P3, P4, P5, P6, P8, BK. BK is a separate building.

---

## API → Dashboard Field Map

| API Endpoint                  | Key Fields                      | Dashboard Use               |
| ----------------------------- | ------------------------------- | --------------------------- |
| `GET /workcells`              | `customer_id`, `workcell_name`  | Workcell selector dropdown  |
| `GET /workcells/by-plant`     | `plant`, `workcell_name`        | Plant → Workcell navigation |
| `GET /workcells/bays`         | `plant`, `bay`                  | Bay list for a workcell     |
| `GET /workcells/routes`       | `route_name`                    | Route list per bay          |
| `GET /workcells/steps`        | `step_name`, `step_description` | Station list                |
| `GET /production/latest`      | `last_scan_dts`, `actual_qty`   | Live activity feed          |
| `GET /production/by-bay`      | `bay`, `total_output`           | Bay output summary          |
| `GET /production/by-assembly` | `assembly`, `total_output`      | Product output list         |
| `GET /assemblies`             | `product_number`, `family_name` | Product catalog             |

---

## Glossary

| Term               | Definition                                                                            |
| ------------------ | ------------------------------------------------------------------------------------- |
| **dim\_** prefix   | Dimension table — master/reference data that rarely changes                           |
| **fact\_** prefix  | Fact table — transactional/measurement data                                           |
| **SCD**            | Slowly Changing Dimension — data that changes occasionally e.g. workcell names        |
| **ETL**            | Extract, Transform, Load — the process of pulling data from MES and storing in SQLite |
| **Caching**        | Storing MES data locally to avoid repeated slow API calls                             |
| **COLLATE NOCASE** | SQLite instruction to ignore uppercase/lowercase differences when comparing text      |
| **WIP**            | Work In Progress — units currently being processed on the floor                       |
| **MRB**            | Material Review Board — bay for holding defective/quarantined units                   |
| **RMA**            | Return Merchandise Authorization — bay for returned units                             |
| **OQA**            | Outgoing Quality Assurance — final quality check before shipment                      |
| **BIRTH**          | First MES registration of a unit — where tracking begins                              |
| **EOL**            | End of Life — workcell or product no longer in production                             |

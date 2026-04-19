import { Elysia } from 'elysia';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuildPlanRow {
  Order_ID: number;
  Plant_ID: number;
  Plant: string;
  SMT_Customer_ID: number;
  Customer: string;
  SMT_Bay_ID: number;
  Bay: string;
  SMT_BayType_ID: string;
  BayType: string;
  SMT_Mode_ID: number;
  Mode: string;
  SMT_Status_ID: number;
  Status: string;
  Sub_Status: string;
  ForeColor: string;
  BgColor: string;
  JobNumber: string;
  BatchNumber: string;
  Quantity: number;
  // ── fields below fetched but not yet displayed ──
  // Hours:              number;
  // Rate:               number;
  // ProjectedStart:     string;
  // ProjectedEnd:       string;
  // SMT_Assembly:       string;
  // Rev:                string;
  // Final_Assembly:     string;
  // PanelSize:          number;
  // Deviation:          string;
  // DoubleSided:        number;
  // LeadFree:           number;
  // Backflushed_Qty:    number;
  // WIP:                number | null;
  // UnitsCompleted:     number;
  // '%':                number;
  // CompletedDateTime:  string | null;
  // Active:             number;
  // Updated:            number;
  // UserID:             string;
  // LastUpdated:        string;
  // Comments:           number;
  // ME_Info:            number;
  // Alerts:             number;
  // Split:              number;
  // MES:                number;
  // FlagColor:          string;
  // Status_Indicator:   string;
  // BottomSide:         number;
  // QRAP:               string;
  // KittingProgressSMT: string;
  // KittingProgressMI:  string;
  // KittingProgressMA:  string;
  // KittingProgressBB:  string;
  // DiscreteJobNumber:  string;
  // CompanyA:           number;
  // 'CompanyA%':        number;
  // MAStart:            number;
  // Packout:            number;
  // 'CompanyB%':        number;
  // SourceId:           number;
  // PLM_Ver:            string;
  // SetupSheetID:       string;
  // RouteName:          string;
  // Route_Step:         string;
  // PoNumber:           string;
  // Flag:               string | null;
  // FA_Rev_Ver:         string | null;
}

const SQL_BRIDGE = 'http://localhost:3001';

// ─── Routes ───────────────────────────────────────────────────────────────────

export const ebuildRoutes = new Elysia({ prefix: '/ebuild' })

  // POST /ebuild/buildplan
  // Body: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
  .post('/buildplan', async ({ body }: { body: { from: string; to: string } }) => {
    if (!body?.from || !body?.to) {
      return new Response('from and to are required', { status: 400 });
    }

    try {
      const res = await fetch(`${SQL_BRIDGE}/buildplan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: body.from, to: body.to }),
      });

      if (!res.ok) {
        const text = await res.text();
        return new Response(`Bridge error: ${text}`, { status: 502 });
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('eBuild bridge error:', err.message);
      return new Response(`Bridge unavailable: ${err.message}`, { status: 503 });
    }
  });

# Campaign System Guide - Marketplace Raid v3.0

## 🎯 Overview

The new Campaign system replaces the simple search-and-enrich flow with a **structured, campaign-based approach** for managing freelancer recruitment on Upwork and Fiverr.

**Key Benefits:**
- ✅ Organize searches by campaigns
- ✅ Track candidates through multiple stages (Kanban pipeline)
- ✅ Manual candidate enrichment per campaign
- ✅ Export by date ranges for specific periods
- ✅ No external APIs required (Clay, Walead, Instantly)

---

## 📋 Architecture

### Data Model

```
Campaign
├── id: string (unique)
├── name: string
├── platform: 'upwork' | 'fiverr'
├── searchTerms: SearchTerms (platform-specific)
├── candidates: EnrichedCandidateInCampaign[]
├── stats: CampaignStats
├── status: 'active' | 'paused' | 'completed'
└── createdAt: ISO timestamp

EnrichedCandidateInCampaign
├── candidateId: string
├── name: string
├── email: string
├── linkedInUrl?: string
├── hourlyRate: number
├── jobSuccessRate: number
├── kanbanLane: 'todo' | 'contacted' | 'replied' | 'rejected' | 'hired'
├── notes?: string
├── addedAt: ISO timestamp
└── platform: FreelancePlatform
```

### Platform-Specific Search Terms

**Upwork:**
- keyword: string
- category: 'Web Development' | 'Mobile App' | 'Desktop' | 'DevOps'
- tests: string[] (required certifications)
- minHourlyRate: number
- maxHourlyRate: number
- minJobSuccessRate: number
- certifications: 'Top Rated' | 'Top Rated Plus' | 'Rising Talent'

**Fiverr:**
- keyword: string
- level: 'basic' | 'pro' | 'top-rated' | 'top-rated-plus'
- languages: string[]
- minHourlyRate: number
- maxHourlyRate: number

---

## 🚀 Getting Started

### 1. Open Marketplace Raid
Click "Marketplace Raid" from the main dashboard.

### 2. Create Your First Campaign

**Steps:**
1. Click the **"Nueva Campaña"** button (top-right, green button)
2. Fill in the campaign details:
   - **Campaign Name:** e.g., "React Developers - Q1 2024"
   - **Platform:** Select Upwork or Fiverr
   - **Common Fields:**
     - Keyword: e.g., "React Developer"
     - Hourly Rate Range: Slide to set min/max budget
     - Job Success Rate: Minimum success % required

3. **Platform-Specific Fields:**

   **For Upwork:**
   - Select Category (Web Development, Mobile App, etc.)
   - Choose Certifications (Top Rated, Rising Talent, etc.)
   - Select Required Tests

   **For Fiverr:**
   - Select Seller Level (Pro, Top Rated, etc.)
   - Select Languages they speak

4. Click **"Crear Campaña"**

---

## 📊 Managing Your Campaign

Once created, you'll see your campaign in the list. **Click on any campaign** to open the dashboard.

### Campaign Dashboard Features

#### 📈 Statistics Panel
Shows real-time stats:
- **Total:** Total candidates in campaign
- **Por Contactar:** Waiting to be contacted (todo lane)
- **Contactados:** Already contacted
- **Respondieron:** Those who replied
- **Contratados:** Successfully hired
- **Tasa Respuesta:** Response rate %

#### 👀 View Toggle
Switch between:

**1. Kanban View** (Default)
- 5 drag-and-drop lanes showing candidate status
- Drag candidates between lanes to update status
- See candidate summary (name, rate, success %, email)
- Color-coded lanes for easy visual tracking

**2. Pipeline View** (List)
- Table format with all candidate details
- Sortable columns (Name, Email, Rate, Success %)
- Status dropdown on each row to update lane
- **Export Date Range:** Filter and export candidates by date added

---

## ➕ Adding Candidates

### Method 1: Manual Enrichment
1. Click **"Agregar"** button (top-right)
2. Fill in candidate details:
   - **Name:** Freelancer name
   - **Email:** Contact email
   - **LinkedIn URL:** (Optional) Direct link
   - **Hourly Rate:** €/hr (slider)
   - **Job Success Rate:** % (slider)
   - **Initial Status:** Choose Kanban lane
   - **Notes:** Add any observations

3. Click **"Agregar"** to add to campaign

### Method 2: Bulk Import (Future)
- Import CSV with candidate details
- Auto-parse and add to campaign

---

## 📨 Exporting Candidates

### From Pipeline View

1. Click **"Exportar"** button (top-right, green)
2. Select date range:
   - **Desde** (From): Start date
   - **Hasta** (Until): End date
3. Click **"Descargar"**

CSV includes:
- Name
- Email
- LinkedIn URL
- Hourly Rate
- Success Rate
- Status/Lane
- Date Added

### Export Tips

**For Outreach:**
- Filter by "Por Contactar" lane first
- Export via date range for weekly outreach
- Import into LinkedIn, Gmail, or email tool

**For Reporting:**
- Export full campaign at end date
- Includes all statuses for tracking metrics
- Calculate ROI per campaign

---

## 🎯 Workflow Example

**Scenario:** Recruiting React Developers

1. **Create Campaign**
   - Name: "React Devs - March 2024"
   - Platform: Upwork
   - Keyword: "React"
   - Categories: Web Development
   - Success Rate Min: 95%
   - Rate Range: €20-€80/hr

2. **Add Candidates**
   - Manually add 10-20 developers found
   - Or use import feature (coming soon)

3. **Track Progress**
   - Move candidates to "Contactado" as you reach out
   - Update to "Respondió" when they reply
   - Mark "Contratado" when hired

4. **Export Weekly**
   - Each Monday, export "Por Contactar" candidates
   - Send personalized outreach messages
   - Update status on responses

5. **Analyze Results**
   - End of month: Export full campaign
   - Calculate response rate: Respondieron / Total
   - Calculate hire rate: Contratados / Total
   - Adjust future campaign parameters

---

## 🎛️ Management Features

### View All Campaigns
- **List View:** Shows all campaigns with stats
- **Quick Stats:** Total candidates, contacted count, response rate visible at a glance
- **Status Badge:** See if campaign is active/paused/completed

### Delete Campaign
1. Go to campaigns list
2. Hover over a campaign
3. Click trash icon (appears on hover)
4. Confirm deletion

### Edit Campaign Notes
In Pipeline or Kanban view, click a candidate and add notes about individual interactions.

---

## 💾 Data Persistence

Currently, campaigns are stored in **local browser state**. They persist during your session but are cleared on browser restart.

### Enable Supabase Persistence (Optional)

To persist campaigns across sessions:

1. Set up Supabase database table:
```sql
CREATE TABLE marketplace_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  search_terms JSONB NOT NULL,
  candidates JSONB NOT NULL,
  stats JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

2. Update CampaignDashboard.tsx to call:
   - `supabase.from('marketplace_campaigns').insert()`
   - `supabase.from('marketplace_campaigns').update()`

(Contact developer for implementation)

---

## 🔄 Status Transitions

### Recommended Kanban Flow

```
Por Contactar (Todo)
        ↓
   [Contact]
        ↓
Contactado (Contacted)
        ↓
    [Wait for reply]
        ├→ Respondió (Replied) → [Negotiate] → Contratado (Hired)
        │
        └→ Rechazó (Rejected)
```

### Status Definitions

| Status | Meaning |
|--------|---------|
| **Por Contactar** | Not yet contacted |
| **Contactado** | Message sent, awaiting reply |
| **Respondió** | Freelancer replied positively |
| **Rechazó** | Declined or not interested |
| **Contratado** | Successfully hired |

---

## 📱 Mobile Responsiveness

The campaign system is optimized for desktop but includes:
- Responsive table on tablets
- Touch-friendly Kanban cards
- Mobile export functionality

For best experience on mobile, use iPad or larger.

---

## ⚙️ Advanced Features (Roadmap)

- 📊 Analytics dashboard with campaign performance metrics
- 📤 CSV bulk import for candidates
- 🔗 LinkedIn profile auto-scraping
- 📧 Email integration for automated follow-ups
- 🧠 AI-powered candidate matching
- 💰 ROI tracking and reporting
- 📅 Campaign scheduling and automation
- 👥 Team collaboration features
- 🔔 Notifications for candidate responses

---

## 🐛 Troubleshooting

**Q: My candidates disappeared after closing the browser**
A: Campaigns are currently stored locally. Refresh the browser and they'll be in the list again. Full persistence coming soon.

**Q: Export shows no candidates**
A: Make sure your date range includes the dates candidates were added. Check the "addedAt" timestamp in Pipeline view.

**Q: Can't drag candidates between lanes**
A: Works best in Kanban view. Ensure you're using a desktop browser (Chrome, Firefox, Safari).

**Q: Campaign creation form shows only Upwork options**
A: Toggle the platform selector at the top of the form to switch to Fiverr-specific fields.

---

## 📞 Support

For questions or features requests, contact the development team.

Last Updated: 2024
System Version: 3.0 - Campaign Management

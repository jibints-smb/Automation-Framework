# Test Cases: BK-7 - Advertiser Accounts

**Story Key:** [BK-7](https://newagesmb.atlassian.net/browse/BK-7)  
**Story Summary:** Advertiser Accounts  
**Project:** Bergen Kids (BK)  
**Component:** Admin Panel  
**Target User Persona:** Super Admin  
**Document Type:** Test Case Specification (.md)

---

## 1. Scope & Objective

Verify that Super Admins can view, approve, block, unblock, delete, search, filter, and export advertiser accounts, while ensuring proper validation messages, real-time counter/badge updates, session terminations for destructive actions, and audit logging.

---

## 2. Test Environment & Preconditions

- **Role:** Super Admin credentials with access to the Admin Panel.
- **Test Data Requirements:**
  - Multiple pending advertiser accounts (at least 12 to test the `10+` badge).
  - Multiple approved advertiser accounts (with active web/app sessions).
  - Multiple blocked advertiser accounts.
  - Accounts with varying names, emails, phone numbers, and join dates.

---

## 3. Test Cases Matrix

### Module 1: Dashboard Summary & Left Navigation Badge

| Test Case ID    | Test Case Title                            | Type                  | Priority | Preconditions                       | Test Steps                                                                 | Expected Result                                                                                                                 |
| :-------------- | :----------------------------------------- | :-------------------- | :------- | :---------------------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **TC_DASH_001** | Verify Dashboard Summary Cards Display     | Functional / UI       | High     | Super Admin logged in               | 1. Navigate to Admin Dashboard.                                            | Summary cards display correctly: Total Advertisers, Approved, Pending, and Total Revenue (shows 0 or dummy count for Sprint 1). |
| **TC_DASH_002** | Verify Left Nav Pending Badge Count (< 10) | Functional            | High     | Exactly 5 pending advertisers exist | 1. Check the left menu beside "Advertiser Accounts".                       | Badge displays exact number `5`.                                                                                                |
| **TC_DASH_003** | Verify Left Nav Pending Badge Count (> 10) | Functional / Boundary | High     | 11 pending advertisers exist        | 1. Check the left menu beside "Advertiser Accounts".                       | Badge displays `10+` instead of 11.                                                                                             |
| **TC_DASH_004** | Verify Badge Dynamic Update upon Approval  | Functional            | High     | 5 pending advertisers exist         | 1. Approve 1 pending advertiser.<br>2. Observe the badge and summary card. | Pending count drops to 4 immediately; left navigation badge updates to `4` without requiring full manual page reload.           |

---

### Module 2: Advertiser Listing & Table View

| Test Case ID    | Test Case Title                        | Type            | Priority | Preconditions                                | Test Steps                                                     | Expected Result                                                                                                                                                                                                                      |
| :-------------- | :------------------------------------- | :-------------- | :------- | :------------------------------------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC_LIST_001** | Verify Column Fields in Table          | UI / Functional | High     | Multiple records exist                       | 1. Open Advertiser Accounts page.<br>2. Inspect table columns. | All required columns appear: Avatar (initials/profile picture), Name/Address/Website link, Contact Person (Name, Email, Phone), Joined Date, Count of Ads (0/dummy in Sprint 1), Revenue (0/dummy in Sprint 1), Status, and Actions. |
| **TC_LIST_002** | Verify Default Sorting Order           | Functional      | Medium   | Multiple accounts created at different times | 1. Open Advertiser Accounts page.<br>2. Observe row order.     | Records are sorted in descending order by Joined Date (latest on top).                                                                                                                                                               |
| **TC_LIST_003** | Verify Total Record Count & Pagination | Functional      | Medium   | > 20 records exist (assuming 10/page)        | 1. Check total count label.<br>2. Navigate across pages.       | Displays total number of records currently shown; pagination controls correctly load subsequent/previous pages.                                                                                                                      |

---

### Module 3: Search Functionality

| Test Case ID    | Test Case Title                                | Type                    | Priority | Preconditions                                | Test Steps                                                            | Expected Result                                                        |
| :-------------- | :--------------------------------------------- | :---------------------- | :------- | :------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **TC_SRCH_001** | Search by Advertiser Name                      | Functional              | High     | Account "Alpha Media" exists                 | 1. Enter "Alpha" in search bar.                                       | Table updates dynamically to display "Alpha Media".                    |
| **TC_SRCH_002** | Search by Email Address                        | Functional              | High     | Account with email "contact@beta.com" exists | 1. Enter "beta.com" or "contact@beta.com".                            | Table filters to show the matching record dynamically.                 |
| **TC_SRCH_003** | Search by Phone Number                         | Functional              | High     | Account with phone "+1987654321" exists      | 1. Enter "987654" in search bar.                                      | Table displays the matching phone number record.                       |
| **TC_SRCH_004** | Verify Search Case Sensitivity & Partial Match | Functional              | Medium   | Account "MegaCorp" exists                    | 1. Search with partial keyword and specific casing per specification. | Partial keyword matching works and follows case handling requirements. |
| **TC_SRCH_005** | Verify Empty Search Result Message             | Functional / Validation | Medium   | No account named "NonExistentX"              | 1. Type "NonExistentX" in search box.                                 | Displays validation message: `"No advertiser accounts found."`         |

---

### Module 4: Filter Functionality

| Test Case ID    | Test Case Title                               | Type       | Priority | Preconditions                                        | Test Steps                                                                                                            | Expected Result                                                                                        |
| :-------------- | :-------------------------------------------- | :--------- | :------- | :--------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **TC_FLTR_001** | Filter by Status (Pending, Approved, Blocked) | Functional | High     | Mix of Pending, Approved, and Blocked accounts exist | 1. Select "Pending" from status filter.<br>2. Select "Approved".<br>3. Select "Blocked".<br>4. Select "All Statuses". | Table displays only records matching selected status, and all records when "All Statuses" is selected. |
| **TC_FLTR_002** | Filter by Specific Advertiser                 | Functional | Medium   | Specific advertisers exist                           | 1. Select an individual advertiser from advertiser filter.                                                            | Table displays records matching the selected advertiser.                                               |
| **TC_FLTR_003** | Verify Multi-Filter Combination               | Functional | High     | Various records exist                                | 1. Select Status = "Approved" and apply an Advertiser filter.<br>2. Type a keyword in search.                         | Table accurately filters records satisfying all applied filter criteria simultaneously.                |

---

### Module 5: Advertiser Lifecycle & Actions

| Test Case ID   | Test Case Title                                         | Type                  | Priority | Preconditions                                   | Test Steps                                                                     | Expected Result                                                                                                                                                                                                                                      |
| :------------- | :------------------------------------------------------ | :-------------------- | :------- | :---------------------------------------------- | :----------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC_ACT_001** | Available Actions for Pending Account                   | Functional / UI       | High     | Pending account displayed                       | 1. Inspect actions column for Pending row.                                     | Only **Approve (✓)** and **Delete** actions are displayed.                                                                                                                                                                                           |
| **TC_ACT_002** | Approve Pending Advertiser Account                      | Functional            | Critical | Pending account exists                          | 1. Click **Approve (✓)** on pending row.                                       | Status immediately transitions to **Approved**; pending count decreases, approved count increases, and left menu badge updates.                                                                                                                      |
| **TC_ACT_003** | Available Actions for Approved Account                  | Functional / UI       | High     | Approved account displayed                      | 1. Inspect actions column for Approved row.                                    | Only **Block** and **Delete** actions are displayed.                                                                                                                                                                                                 |
| **TC_ACT_004** | Block Approved Advertiser Account & Verify Session Kill | Functional / Security | Critical | Approved advertiser logged in on web & app      | 1. Click **Block**.<br>2. Verify modal text.<br>3. Confirm block action.       | 1. Confirmation dialog appears: `"<Advertiser name> will lose access immediately. You can unblock them at any time."`<br>2. Status updates to **Blocked**.<br>3. Active web and mobile sessions are instantly terminated; login disabled.            |
| **TC_ACT_005** | Unblock Advertiser Account & Verify Audit Log           | Functional            | High     | Blocked account exists                          | 1. Click **Unblock**.<br>2. Verify status and audit logs.                      | Status transitions back to **Approved**; advertiser regains login access; action is logged in audit log.                                                                                                                                             |
| **TC_ACT_006** | Delete Advertiser Account (Destructive Action)          | Functional / Security | Critical | Advertiser account exists (with active session) | 1. Click **Delete**.<br>2. Inspect confirmation modal.<br>3. Confirm deletion. | 1. Confirmation dialog appears: `"<Advertiser name> will be permanently removed. This cannot be undone."`<br>2. Account is permanently deleted.<br>3. Immediate session invalidation/logout if logged in.<br>4. Record no longer appears in listing. |
| **TC_ACT_007** | Cancel Destructive Action Modal                         | Functional            | Medium   | Any account                                     | 1. Click Delete / Block.<br>2. Click Cancel / Close on dialog.                 | Dialog closes; no changes made to status or account existence.                                                                                                                                                                                       |

---

### Module 6: Export to CSV

| Test Case ID   | Test Case Title                  | Type                    | Priority | Preconditions                    | Test Steps                                               | Expected Result                                                                                                    |
| :------------- | :------------------------------- | :---------------------- | :------- | :------------------------------- | :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **TC_EXP_001** | Export Full Listing to CSV       | Functional              | High     | Records exist with no filters    | 1. Click **Export** button.                              | Generates and downloads `.csv` file containing all advertiser records with correct headers and data.               |
| **TC_EXP_002** | Export Filtered/Searched Results | Functional              | High     | Search or filters applied        | 1. Filter by Status = "Blocked".<br>2. Click **Export**. | Downloaded CSV contains only the filtered/searched dataset.                                                        |
| **TC_EXP_003** | Export with No Available Records | Functional / Validation | Medium   | Zero records match search/filter | 1. Trigger export when table is empty.                   | Displays validation message: `"There are no advertiser accounts available to export."` No empty CSV is downloaded. |

---

## 4. Traceability & Definition of Done (DoD) Checklist

- [x] Dashboard statistics display correctly (Total, Approved, Pending, Revenue).
- [x] Pending approval badge updates automatically (maximum display 10+).
- [x] Advertiser listing loads correctly with required columns & avatar.
- [x] Search works across all supported fields (Name, Email, Phone).
- [x] Status and advertiser filters work independently and together.
- [x] Pending advertisers can be approved.
- [x] Approved advertisers can be blocked with instant session kill.
- [x] Blocked advertisers can be unblocked with audit log recorded.
- [x] Delete permanently removes advertiser accounts after confirmation.
- [x] Export generates CSV based on current filters/search.
- [x] Confirmation dialogs and exact validation messages are displayed.

# Rewards program (pilot)

Barbers earn a free subscription month by bringing real clients. A captured client counts only when
QUALIFIED (verified email and own activity on a later La Paz calendar day). Rewards are approved
manually by an admin.

## Configuration (env vars)

| Variable | Default | Purpose |
| --- | --- | --- |
| `REWARD_ACQUISITION_GOAL` | 15 | Qualified clients needed for the bonus (goalKey `ACQ_<goal>`) |
| `REWARD_MAX_FREE_MONTHS` | 3 | Lifetime cap of free months per barber |
| `REWARD_QUALIFY_MIN_DAYS_AFTER_SIGNUP` | 1 | La Paz days between signup and qualifying activity |
| `ADMIN_API_KEY` | unset | Admin key. **Unset = admin endpoints answer 404 (disabled).** |

## Barber endpoints (barber JWT)

- `GET /barbers/me/acquisitions` - real progress (`qualified`, `pending`, `goal`, `remaining`, `goalReached`, `claim`, ...).
- `POST /barbers/me/acquisitions/claim` - creates a PENDING claim. 201 created, 400 goal not reached,
  409 already claimed (returns the existing claim), 403 lifetime cap reached. Never credits months.

A rejected claim stays in the table, so the same barber cannot re-claim the same goal.

## Admin endpoints

Served at `/admin/rewards/*` and `/api/admin/rewards/*`. Send the header `x-admin-key: <ADMIN_API_KEY>`
(compared in constant time). 404 when the key is not configured, 401 when the header is missing, 403 when wrong.

- `GET  /admin/rewards/claims?status=PENDING` - claims with barber info and a review summary
  (qualified clients grouped by signup IP and device, disposable-email count, average hours to qualify).
- `POST /admin/rewards/claims/:id/approve` - PENDING -> APPROVED and +1 `freeMonthsEarned` (only below the cap). 409 if not PENDING.
- `POST /admin/rewards/claims/:id/reject` - body `{ "note": "reason" }` (required). PENDING -> REJECTED.
- `POST /admin/rewards/claims/:id/reverse` - body `{ "note"?: string, "revokeClients"?: boolean }`.
  APPROVED -> REVERSED, -1 `freeMonthsEarned` (not below 0). With `revokeClients: true` all of the barber's
  QUALIFIED clients become REVOKED.

## Review flow

1. Barber reaches the goal and claims it (status PENDING).
2. Admin lists pending claims and inspects the review summary (many clients sharing an IP or device, or
   disposable email domains, are red flags).
3. Admin approves or rejects. Approval credits one free month atomically; double approval cannot double-credit.
4. If abuse is found later, admin reverses the claim.

## Approving a claim with curl

```bash
curl -H "x-admin-key: $ADMIN_API_KEY" "<API_URL>/admin/rewards/claims?status=PENDING"

curl -X POST -H "x-admin-key: $ADMIN_API_KEY" "<API_URL>/admin/rewards/claims/<CLAIM_ID>/approve"

curl -X POST -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"note":"<reason>"}' "<API_URL>/admin/rewards/claims/<CLAIM_ID>/reject"
```

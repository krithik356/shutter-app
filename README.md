# Shutter — Instagram ad automation wizard (prototype)

A React + Tailwind prototype of the onboarding wizard: URL → brand kit → ad prompt →
image selection → caption → connect Instagram → daily dashboard.

Currently uses mock data (`src/data/mockData.js`) — no live backend calls yet.

## Run it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Project structure

```
src/
  App.jsx                  — step router, wires the wizard together
  data/mockData.js         — all mock/placeholder data, swap for real API calls later
  components/
    TopBar.jsx
    FilmRail.jsx            — the film-strip progress bar at the top
    steps/
      Step1Url.jsx
      Step2Developing.jsx
      Step3BrandKit.jsx
      Step4Prompt.jsx
      Step5Images.jsx
      Step6Caption.jsx
      Step7Connect.jsx
      Step8Dashboard.jsx
```

## Next: wiring in the real backend

Each step currently reads from `mockData.js`. To make it real:

1. Step 1 -> `POST /api/brand-kit` (scrape URL + Claude call) -> returns data for Step 3
2. Step 4 -> `POST /api/generate-concept` (Claude call) -> returns prompt text
3. Step 5 -> `POST /api/generate-images` (Ideogram/Recraft call) -> returns image URLs
4. Step 6 -> `POST /api/generate-caption` (Claude call)
5. Step 7 -> Instagram OAuth flow (Meta Login for Business)
6. Step 8 -> `GET /api/posts` for history, `POST /api/posts/:id/approve` to publish

## Database: MongoDB

Two collections. `users` holds everything that's one-per-user and changes together
(brand kit, IG connection, schedule) as embedded sub-documents — no joins needed to
render the dashboard's settings. `posts` is a separate, append-only collection since it
grows daily and is queried independently (post history, pending approvals).

```js
// users
{
  _id: ObjectId,
  email: "owner@northbrewcoffee.com",
  createdAt: ISODate,
  websiteUrl: "northbrewcoffee.com",
  brandKit: {
    businessName: "North Brew Coffee",
    summary: "...",
    colors: ["#2B4C3F", "#C97B3D", "#F4EFE6", "#1A1A1A"],
    products: ["Ethiopia Yirgacheffe — $18", "..."],
    tone: "warm, unpretentious, community-focused",
    updatedAt: ISODate
  },
  igAccount: {
    igBusinessId: "17841...",
    accessToken: "encrypted...",
    tokenExpiresAt: ISODate,
    username: "northbrewcoffee"
  },
  schedule: {
    postTime: "09:00",
    timezone: "America/Chicago",
    autoApprove: false
  }
}

// posts
{
  _id: ObjectId,
  userId: ObjectId,          // indexed
  promptUsed: "Overhead shot of a matte kraft coffee bag...",
  imageUrl: "https://.../post-2026-07-17.png",
  caption: "Mornings are better with something worth waking up for...",
  hashtags: ["#specialtycoffee", "#ethiopiacoffee"],
  status: "pending",         // pending | approved | posted | rejected
  scheduledFor: ISODate,
  postedAt: null,
  createdAt: ISODate
}
```

Indexes worth adding early: `posts.userId + posts.createdAt` (dashboard history),
`posts.status` (finding pending approvals for the daily loop).

Hosting: **MongoDB Atlas** free tier is the easiest start — managed, no ops, and the
driver is a drop-in for both Node (`mongoose`) and Python (`pymongo`/`motor`) backends.

## Opening in Antigravity

1. Unzip this project.
2. Open Antigravity -> Open Folder -> select the unzipped `shutter-app` folder.
3. Run `npm install` in the integrated terminal, then `npm run dev`.
4. You can now hand tasks to the agent directly - e.g. "wire Step 1 to a real backend
   endpoint that scrapes the URL and calls Claude" - since the whole project is already
   structured by step/component for easy targeted edits.

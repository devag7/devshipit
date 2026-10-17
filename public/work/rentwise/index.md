# RentWise

> Case study: RentWise, a Bangalore rental platform built with Next.js, TypeScript, PostgreSQL, Redis and Socket.io.

A rental platform for Bangalore that collects listings automatically, pushes updates in real time and gives each kind of user the right level of access.

- **Role**: Design and development, solo
- **Built**: March to April 2026 (2.0)
- **Status**: Live
- **Stack**: Next.js, TypeScript, PostgreSQL, Redis, Socket.io, Docker, Playwright, Mapbox GL JS, Supabase

## The problem

Finding a rental in Bangalore means checking several sites and refreshing them by hand. RentWise started in March 2026 as an attempt to put listings in one place and keep them fresh without manual data entry.

## What I built

- **Automated listing collection.** Playwright scrapers running in Docker containers gather listings automatically.
- **Real-time updates.** Socket.io pushes changes to open sessions over WebSockets, so users see new data without reloading.
- **Role-based access.** Four roles (guest, user, landlord and admin) each see and can do different things.
- **Maps.** Mapbox GL JS powers the map views.
- **Typed end to end.** The app is written in TypeScript on Next.js, with PostgreSQL (through Supabase) for data and Redis alongside it.

## RentWise 2.0

In March and April 2026 I rebuilt the project as RentWise 2.0 and wrote it up as a university academic report, matching the exact formatting my university requires. It is the project I treat as the centerpiece of my portfolio.

[Live demo](https://bit.ly/4uiOams) [Source on GitHub](https://github.com/devag7/rentwise)

---

Canonical page: https://devshipit.com/work/rentwise/  
Site guide for agents: https://devshipit.com/llms.txt  
Contact: hello@devshipit.com

# JantaHR

> Case study: JantaHR, open-source HR and payroll for Indian companies, built with NestJS, Next.js, Supabase and Razorpay.

Open-source HR and payroll for Indian companies. It works out PF, ESI, professional tax, LWF and TDS every month and produces the files companies file with the government.

[Open JantaHR](https://jantahr.devshipit.com) [Pricing](https://jantahr.devshipit.com/pricing) [Source on GitHub](https://github.com/devag7/jantahr)

- **Role**: Design and development, solo
- **Built**: September to October 2026
- **Status**: Live at [jantahr.devshipit.com](https://jantahr.devshipit.com)
- **Stack**: NestJS, Prisma, PostgreSQL, Next.js, Supabase (Auth, Postgres, Storage), Vercel, Razorpay, Expo

![Compliance calendar listing salary, TDS, EPF, ESI and return deadlines with their status](https://devshipit.com/assets/img/jantahr-compliance.webp)

The compliance calendar lists each deadline with its status.

![A payroll run with gross pay, deductions, net pay and employer contributions for each month](https://devshipit.com/assets/img/jantahr-payroll.webp)

A payroll run, with gross pay, deductions, net pay and employer contributions.

![Employee home screen on a phone with attendance check-in and leave balance](https://devshipit.com/assets/img/jantahr-mobile.webp)

The employee home screen, with attendance check-in and leave balance.

## The problem

Indian payroll is mostly rules that keep changing: a provident fund wage ceiling that moved mid-month in September 2026, ESI contribution periods, professional tax that differs by state, and income tax under two regimes. Small companies either pay per-employee SaaS fees or keep spreadsheets. JantaHR is a third option they can run themselves or subscribe to.

## What I built

- **Payroll engine.** Formula-based salary structures, proration for mid-month joiners, loss of pay from attendance, arrears and loans, with every statutory rule linked to the notification it comes from.
- **Filing outputs.** EPF ECR, ESI, professional tax and LWF registers, bank advice and a quarterly TDS extract, plus a compliance calendar that ticks items off as they are filed.
- **Everything around payroll.** Leave, geo-fenced attendance, onboarding and exits with full and final settlement, appraisals, recruitment, expenses and a helpdesk, with a guided setup for new companies.
- **Privacy and security.** Supabase Auth with two-factor sign-in, field-level encryption for PAN, Aadhaar and bank details, row-level security and tools for the DPDP Act.
- **A real subscription business.** Per-seat plans billed through Razorpay subscriptions, with webhooks, invoices and a 14-day trial.

## How it runs

The web app and API deploy as one Vercel project in Mumbai, backed by Supabase Postgres, Storage and scheduled jobs. Companies that prefer their own servers can self-host the whole product with one command.

---

Canonical page: https://devshipit.com/work/jantahr/  
Site guide for agents: https://devshipit.com/llms.txt  
Contact: hello@devshipit.com

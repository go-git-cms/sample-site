---
blocks:
  - _variant: richText
    body: |
      Reconciliation ran as a nightly batch. When it failed — which it did about
      once a fortnight — nobody found out until the morning, and the fix was to
      re-run six hours of work and hope.

      The batch was not the problem. The problem was that the system had no
      record of *why* a balance was what it was, only what it currently equalled.
    heading: The problem
  - _variant: metrics
    items:
      - label: Events / day
        value: 4.1M
      - label: p99 write
        value: 12ms
      - label: Batch jobs removed
        value: "3"
  - _variant: richText
    body: |
      An append-only event store where every balance is a fold over its history.
      Reconciliation stopped being a job and became a query — one you can run at
      any point in time, against any account, and get an auditable answer.

      The hard part was not the store. It was convincing everyone that deleting
      the nightly job was safe, which took a parallel run of six weeks and a
      dashboard nobody looked at after the third week.
    heading: What we built
  - _variant: cta
    body: I wrote up the migration strategy in more detail.
    buttonHref: /articles/reading-the-diff/
    buttonLabel: Read the article
    heading: Want the long version?
featured: true
role: Tech lead
seo:
  description: Ledger — an append-only event store that replaced nightly financial reconciliation with a point-in-time query.
slug: ledger
status: shipped
summary: An append-only event store for financial reconciliation, handling about four million events a day without a nightly batch job.
tags:
  - go
  - postgres
  - distributed-systems
title: Ledger
url: https://example.com/ledger
year: 2025
---

Ledger is still running, largely unchanged, which I consider the highest
compliment a system can receive.

---
blocks:
  - _variant: richText
    body: |
      Teams that deploy once a fortnight are not being careful. They are being
      slow *because* they are frightened, and they are frightened because
      deploying is rare enough to still be unfamiliar.

      Every tool we looked at optimised the case where you deploy constantly.
    heading: The observation
  - _variant: metrics
    items:
      - label: Median deploys / week
        value: 1 → 14
      - label: Rollback time
        value: 40s
      - label: Teams onboarded
        value: "31"
  - _variant: richText
    body: |
      Harbour made rollback the loudest button on the screen. Not deploy —
      rollback. Once people believed they could undo a deploy in under a minute,
      they stopped batching changes, and the batching was most of the risk.

      Nothing about the underlying pipeline changed. The interface changed, and
      the behaviour followed it.
    heading: What changed
featured: true
role: Founding engineer
seo:
  description: Harbour — a deployment tool that raised deploy frequency fourteen-fold by making rollback the most prominent action.
slug: harbour
status: shipped
summary: A deployment tool for teams who deploy rarely and are frightened of it. Made the scary path the default path.
tags:
  - typescript
  - developer-tooling
title: Harbour
year: 2024
---

Harbour is the project I point at when someone tells me tooling is not a
product problem.

---
excerpt: Six years of carrying a pager, distilled into the handful of things that actually reduced the number of times it went off.
publishDate: "2026-02-11"
slug: notes-on-on-call
tags:
  - operations
  - engineering
title: Notes on being on call
---

I carried a pager for six years. Here is nearly everything I learned, which is
less than you would hope.

## Alerts should be actionable or absent

The single biggest improvement we made was deleting alerts. Not tuning them —
deleting them.

An alert that fires and requires no action teaches you to ignore alerts. Two
weeks of that and the one that matters arrives in an inbox you have stopped
reading. Every alert should name a thing a human can do at 3am. If it cannot,
it is a dashboard, not an alert.

## The runbook is the alert

We stopped writing runbooks as separate documents nobody could find. The link
goes in the alert payload, and if the alert has no runbook link it does not get
to page anyone.

This sounds bureaucratic. It took our median time-to-first-useful-action from
about twenty minutes to about four.

## Write the postmortem while you are still annoyed

The instinct after an incident is to sleep and write it up tomorrow. By tomorrow
you have rationalised it. The version you write at the end of the incident is
angrier, less polished, and much more honest about what actually confused you.

Edit the tone later. Capture the confusion now — the confusion is the finding.

## What did not help

Rotating on-call more widely, in our case, made things worse before it made them
better: more people carrying the pager meant less context per person and more
escalation. It was still the right call, but it took two quarters to pay off and
I wish someone had told us that.

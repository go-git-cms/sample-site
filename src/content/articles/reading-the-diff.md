---
excerpt: Code review is not a search for defects. It is a check on whether the change means what its author thinks it means.
featured: true
publishDate: "2026-04-02"
slug: reading-the-diff
tags:
  - engineering
  - teams
title: Reading the diff
updateDate: "2026-04-09"
---

Most advice about code review is about finding bugs. I think that is the least
valuable thing review does, and treating it as the goal is why so much review
feels like theatre.

A test suite finds bugs more reliably than I do at 4pm on a Thursday.

## What review is actually for

Review is where a change stops being one person's idea and becomes the team's
code. The useful question is not "is this correct" but **"does this change mean
what its author thinks it means?"**

Those come apart more often than you would expect. The code does what it says.
The author believes it does something slightly different — usually something
more general, or more permanent, than what they wrote.

## Three questions

I ask the same three things on nearly every review:

1. **What happens the second time?** Most bugs I catch are about a code path
   being run again, concurrently, or after a partial failure.
2. **What is this now committing us to?** A new field in a public payload is
   forever. A new internal helper is not. These deserve very different scrutiny.
3. **Where would I look if this broke?** If I cannot answer, the change needs a
   log line or a name change more than it needs anything else.

## On being reviewed

The hardest part of review is that a good one feels like an accusation and a
polite one teaches nobody anything.

The only fix I have found is to make the reasoning visible in the change itself.
A description that explains what was rejected and why turns review from
interrogation into a conversation that has already started.
